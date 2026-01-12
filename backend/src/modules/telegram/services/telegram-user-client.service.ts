import { Injectable, Logger, OnModuleDestroy, HttpException, Inject, forwardRef, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, Storage, StorageKeyPart } from '@mtkruto/node';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { SessionEncryptionService } from './session-encryption.service';
import { TelegramSessionService } from './telegram-session.service';
import { TelegramHeartbeatService } from './telegram-heartbeat.service';
import { TelegramClientEventEmitter } from './telegram-client-event-emitter.service';
import { TelegramConnectionMonitorService } from './telegram-connection-monitor.service';
import { User, UserRole } from '../../../entities/user.entity';
import { handleMtprotoError, MtprotoErrorAction } from '../utils/mtproto-error.handler';
import { assertSessionTransition } from '../utils/session-state-machine';

/**
 * Кастомный Storage адаптер для MTKruto, который сохраняет сессии в БД с шифрованием
 */
// @ts-ignore - временно игнорируем ошибку типов Storage
class DatabaseStorage implements Partial<Storage> {
  constructor(
    private sessionRepository: Repository<TelegramUserSession>,
    private encryptionService: SessionEncryptionService,
    private sessionId: string, // КРИТИЧНО: Storage привязан к sessionId, а не userId
  ) {}

  async initialize(): Promise<void> {
    // Инициализация storage - ничего не делаем, так как данные уже в БД
    return Promise.resolve();
  }

  async get<T = Uint8Array>(key: readonly StorageKeyPart[]): Promise<T | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          id: this.sessionId, // КРИТИЧНО: ищем по sessionId, не userId
        },
      });

      if (!session) {
        return null;
      }

      const decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
      const data = JSON.parse(decrypted);

      // Ищем значение по ключу
      let current: any = data;
      for (const part of key) {
        if (current === null || typeof current !== 'object') {
          return null;
        }
        current = current[String(part)];
        if (current === undefined) {
          return null;
        }
      }

      // Обрабатываем разные типы данных
      if (typeof current === 'string') {
        // Проверяем, является ли это base64 строкой (бинарные данные)
        // Base64 строки обычно длиннее и содержат только base64 символы
        if (current.length > 20 && /^[A-Za-z0-9+/=]+$/.test(current)) {
          try {
            // Пытаемся декодировать как base64 (бинарные данные)
            const decoded = Buffer.from(current, 'base64');
            return new Uint8Array(decoded) as T;
          } catch {
            // Если не base64, пытаемся как обычную строку
            return new TextEncoder().encode(current) as T;
          }
        } else {
          // Короткая строка или не base64 - может быть BigInt сохраненный как строка
          // Или обычная строка - возвращаем как есть или конвертируем в Uint8Array
          // Если ожидается Uint8Array, конвертируем
          return new TextEncoder().encode(current) as T;
        }
      }

      // Если это число - возвращаем как есть
      if (typeof current === 'number') {
        return current as T;
      }

      // Если это массив чисел (старый формат), конвертируем в Uint8Array
      if (Array.isArray(current)) {
        return new Uint8Array(current) as T;
      }

      // Если это уже Uint8Array, возвращаем как есть
      if (current instanceof Uint8Array) {
        return current as T;
      }

      // Для других типов возвращаем null или значение как есть
      return (current !== null && current !== undefined ? current : null) as T | null;
    } catch (error) {
      return null;
    }
  }

  async set(key: readonly StorageKeyPart[], value: Uint8Array): Promise<void> {
    try {
      // КРИТИЧНО: Storage хранит ТОЛЬКО Uint8Array (transport/crypto state)
      // MTKruto НЕ использует Storage для бизнес-данных
      if (!(value instanceof Uint8Array)) {
        // Игнорируем не-Uint8Array значения (MTKruto не должен их сохранять)
        return;
      }

      // КРИТИЧНО: Используем транзакцию с блокировкой для предотвращения race condition
      // При множественных одновременных вызовах set() данные могут перезаписывать друг друга
      await this.sessionRepository.manager.transaction('REPEATABLE READ', async (manager) => {
        const session = await manager.findOne(TelegramUserSession, {
          where: { id: this.sessionId },
          lock: { mode: 'pessimistic_write' }, // Блокируем запись
        });

        if (!session) {
          throw new Error(`Session ${this.sessionId} not found. Session must be created before using DatabaseStorage.`);
        }

        let data: any = {};

        if (session.encryptedSessionData) {
          try {
            if (session.encryptedSessionData.trim() !== '' && session.encryptedSessionData !== '{}') {
              const decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
              if (decrypted && decrypted.trim() !== '' && decrypted !== '{}') {
                data = JSON.parse(decrypted);
              }
            }
          } catch (decryptError) {
            // Если не удалось расшифровать (сессия повреждена или пустая), начинаем с пустого объекта
            data = {};
          }
        }

        // Устанавливаем значение по ключу
        let current: any = data;
        for (let i = 0; i < key.length - 1; i++) {
          const part = String(key[i]);
          if (current[part] === undefined || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part];
        }

        const lastKey = String(key[key.length - 1]);
        
        // КРИТИЧНО: Сохраняем ТОЛЬКО Uint8Array как base64
        current[lastKey] = Buffer.from(value).toString('base64');

        const encrypted = this.encryptionService.encrypt(JSON.stringify(data));

        session.encryptedSessionData = encrypted;
        session.lastUsedAt = new Date();
        if (!session.isActive) {
          session.isActive = true;
        }
        await manager.save(session);
      });
    } catch (error: any) {
      throw new Error(`Failed to save session data: ${error.message}`);
    }
  }

  async delete(key: readonly StorageKeyPart[]): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          id: this.sessionId, // КРИТИЧНО: ищем по sessionId, не userId
        },
      });

      if (!session) {
        return;
      }

      // КРИТИЧНО: Проверка на null и обработка ошибок decrypt
      if (!session.encryptedSessionData || session.encryptedSessionData.trim() === '') {
        return;
      }

      let decrypted: string;
      try {
        decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
      } catch (error: any) {
        // Если не удалось расшифровать - просто возвращаемся (Storage контракт)
        return;
      }

      const data = JSON.parse(decrypted);

      // Удаляем значение по ключу
      let current: any = data;
      for (let i = 0; i < key.length - 1; i++) {
        const part = String(key[i]);
        if (current[part] === undefined || typeof current[part] !== 'object') {
          return; // Ключ не существует
        }
        current = current[part];
      }

      const lastKey = String(key[key.length - 1]);
      delete current[lastKey];

      const encrypted = this.encryptionService.encrypt(JSON.stringify(data));
      session.encryptedSessionData = encrypted;
      session.lastUsedAt = new Date();
      await this.sessionRepository.save(session);
    } catch (error: any) {
      // Игнорируем ошибки удаления
    }
  }

  // Метод getMany требуется MTKruto для операций с несколькими ключами
  // Используется при connect() для очистки обновлений
  async *getMany<T = Uint8Array>(
    filter: any, // GetManyFilter может быть массивом, объектом с prefix, или объектом с start/end
    params?: { limit?: number; reverse?: boolean },
  ): AsyncGenerator<[readonly StorageKeyPart[], T], any, any> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          id: this.sessionId, // КРИТИЧНО: ищем по sessionId, не userId
        },
      });

      if (!session || !session.encryptedSessionData) {
        // Если сессии нет или данные пустые, возвращаем пустой генератор
        return;
      }

      let data: any = {};
      try {
        const decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
        // Проверяем, что расшифрованные данные не пустые
        if (decrypted && decrypted.trim() !== '' && decrypted !== '{}') {
          data = JSON.parse(decrypted);
        }
      } catch (decryptError) {
        // Если не удалось расшифровать (например, сессия только создается), возвращаем пустой генератор
        return;
      }

      // Определяем префикс для поиска
      let prefix: readonly StorageKeyPart[] = [];
      if (Array.isArray(filter)) {
        prefix = filter;
      } else if (filter && typeof filter === 'object') {
        if ('prefix' in filter) {
          prefix = filter.prefix;
        } else if ('start' in filter) {
          prefix = filter.start;
        }
      }
      
      // Рекурсивно ищем все ключи с указанным префиксом
      const findKeys = (obj: any, currentPath: StorageKeyPart[]): Array<[readonly StorageKeyPart[], T]> => {
        const results: Array<[readonly StorageKeyPart[], T]> = [];
        
        // Проверяем, соответствует ли текущий путь префиксу
        if (prefix.length > currentPath.length) {
          // Нужно углубиться дальше
          const nextPart = prefix[currentPath.length];
          if (obj && typeof obj === 'object' && obj[String(nextPart)] !== undefined) {
            return findKeys(obj[String(nextPart)], [...currentPath, nextPart]);
          }
          return results;
        }
        
        // Если путь соответствует префиксу, ищем все дочерние ключи
        if (prefix.length === currentPath.length || prefix.length === 0) {
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              const fullPath = [...currentPath, key] as readonly StorageKeyPart[];
              
              // КРИТИЧНО: getMany() возвращает ТОЛЬКО Uint8Array (бинарные данные)
              // MTKruto ожидает Uint8Array для всех ключей из Storage
              if (typeof value === 'string') {
                // Проверяем, является ли это base64 строкой (бинарные данные)
                if (value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
                  try {
                    const decoded = Buffer.from(value, 'base64');
                    const uint8Array = new Uint8Array(decoded) as T;
                    results.push([fullPath, uint8Array]);
                  } catch {
                    // Если не base64, пропускаем (не бинарные данные)
                  }
                }
                // Короткие строки или не-base64 - пропускаем (не бинарные данные)
              } else if (Array.isArray(value)) {
                // Массив чисел (старый формат) - конвертируем в Uint8Array
                const uint8Array = new Uint8Array(value) as T;
                results.push([fullPath, uint8Array]);
              } else if (value instanceof Uint8Array) {
                // Уже Uint8Array - возвращаем как есть
                results.push([fullPath, value as T]);
              } else if (typeof value === 'object' && value !== null) {
                // Объекты - рекурсивно обрабатываем (может содержать вложенные бинарные данные)
                const nestedResults = findKeys(value, [...fullPath] as StorageKeyPart[]);
                results.push(...nestedResults);
              }
              // Все остальные типы (number, boolean, null) - пропускаем
              // MTKruto не использует Storage для бизнес-данных
            }
          }
        }
        
        return results;
      };

      const matches = findKeys(data, []);
      const limit = params?.limit || matches.length;
      const sorted = params?.reverse ? matches.reverse() : matches;
      
      for (let i = 0; i < Math.min(limit, sorted.length); i++) {
        yield sorted[i];
      }
    } catch (error) {
      // Возвращаем пустой генератор при ошибке
      return;
    }
  }
}

@Injectable()
export class TelegramUserClientService implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramUserClientService.name);
  private clients: Map<string, Client> = new Map(); // sessionId -> Client (ИЗМЕНЕНО: было userId -> Client)

  constructor(
    private configService: ConfigService,
    @InjectRepository(TelegramUserSession)
    private sessionRepository: Repository<TelegramUserSession>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private encryptionService: SessionEncryptionService,
    private telegramSessionService: TelegramSessionService,
    @Optional() @Inject(forwardRef(() => TelegramHeartbeatService))
    private heartbeatService?: TelegramHeartbeatService,
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private eventEmitter?: TelegramClientEventEmitter,
    @Optional() @Inject(forwardRef(() => TelegramConnectionMonitorService))
    private connectionMonitorService?: TelegramConnectionMonitorService,
  ) {
    this.logger.log('TelegramUserClientService initialized');
    if (this.heartbeatService) {
      this.logger.log('HeartbeatService integration enabled');
    } else {
      this.logger.debug('HeartbeatService not available (optional)');
    }
    if (this.eventEmitter) {
      this.logger.log('TelegramClientEventEmitter integration enabled');
    } else {
      this.logger.debug('TelegramClientEventEmitter not available (optional)');
    }
  }

  /**
   * Получает или создает MTProto клиент для конкретной сессии
   * КРИТИЧЕСКИ ВАЖНО: Требует sessionId - не выбирает "любую активную сессию"
   * Это гарантирует детерминированное поведение и правильный lifecycle
   */
  async getClient(sessionId: string): Promise<Client | null> {
    // Используем детерминированный метод по sessionId
    return this.getClientBySession(sessionId);
  }

  /**
   * @deprecated Используйте getClient(sessionId) вместо этого метода
   * Этот метод нарушает принцип "один client = одна sessionId"
   * и может вернуть не ту сессию при наличии нескольких активных сессий
   */
  async getClientByUserId(userId: string): Promise<Client | null> {
    throw new Error('getClientByUserId is deprecated. Use getClient(sessionId) instead. This method violates the "one client = one sessionId" principle.');
    try {
      this.logger.log(`Looking for active Telegram session for userId: ${userId}`);

      // Ищем активные сессии со статусом 'active' (валидные сессии)
      const activeSessions = await this.sessionRepository.find({
        where: {
          userId,
          isActive: true,
          status: 'active', // Только валидные сессии
        },
        order: {
          lastUsedAt: 'DESC',
        },
      });
      
      this.logger.log(`Found ${activeSessions.length} active session(s) in database`);
      
      if (activeSessions.length === 0) {
        this.logger.warn(`No active Telegram sessions found in database`);
        return null;
      }

      // Берем самую свежую активную сессию
      const session = activeSessions[0];
      this.logger.log(`Using active session: id=${session.id}, phoneNumber=${session.phoneNumber}, userId=${session.userId}, lastUsedAt=${session.lastUsedAt}`);
      
      // Логируем все активные сессии для информации
      if (activeSessions.length > 1) {
        this.logger.log(`Total active sessions: ${activeSessions.length}`);
        activeSessions.slice(1).forEach((s, index) => {
          this.logger.log(`Other active session ${index + 1}: id=${s.id}, phoneNumber=${s.phoneNumber}, userId=${s.userId}`);
        });
      }

      // КРИТИЧЕСКИ ВАЖНО: Используем sessionId для кеша, не userId
      // Один клиент = одна сессия
      const sessionId = session.id;
      
      // Проверяем, есть ли уже активный клиент для этой сессии
      if (this.clients.has(sessionId)) {
        const client = this.clients.get(sessionId)!;
        if (client.connected) {
          this.logger.debug(`Using cached client for session ${sessionId}`);
          return client;
        }
        // Если клиент отключен, удаляем его
        this.clients.delete(sessionId);
        // Очищаем статус heartbeat для этой сессии (Task 1.2)
        this.heartbeatService?.clearHeartbeatStatus(sessionId);
      }

      // Получаем API credentials
      const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      const apiId = parseInt(apiIdStr, 10);
      if (isNaN(apiId)) {
        throw new Error('TELEGRAM_API_ID must be a valid number');
      }

      // ВАЖНО: Согласно примерам, правильный lifecycle MTKruto:
      // 1️⃣ Загрузить данные из БД (storage уже знает, где искать)
      // 2️⃣ Storage уже заполнен (данные в БД)
      // 3️⃣ Создать client
      // 4️⃣ ТОЛЬКО ТЕПЕРЬ connect
      
      // Проверяем, что сессия действительно существует и имеет данные
      const sessionData = await this.sessionRepository.findOne({
        where: { id: session.id },
      });
      
      if (!sessionData) {
        this.logger.error(`Session ${session.id} not found in database!`);
        return null;
      }
      
      // NULL допустим (данные еще не сохранены), но '{}' - запрещено
      if (sessionData.encryptedSessionData === '{}' || (sessionData.encryptedSessionData && sessionData.encryptedSessionData.trim() === '')) {
        this.logger.error(`Session ${session.id} has empty or invalid encryptedSessionData (${sessionData.encryptedSessionData})!`);
        return null;
      }
      
      // Если encryptedSessionData === null, это нормально - данные будут загружены через storage
      if (sessionData.encryptedSessionData === null) {
        this.logger.debug(`Session ${session.id} has null encryptedSessionData - will load from storage`);
      }
      
      this.logger.log(`Session ${session.id} found with data, creating storage and client...`);

      // КРИТИЧНО: Создаем Storage адаптер привязанный к sessionId
      // Storage будет загружать данные из БД при вызове get/getMany
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        session.id, // КРИТИЧНО: передаем sessionId, не userId
      );

      // Инициализируем storage (если требуется)
      await storage.initialize();

      // Создаем клиент (storage уже знает, где искать данные)
      // @ts-ignore - временно игнорируем ошибку типов Storage
      const client = new Client({
        apiId,
        apiHash,
        storage: storage as any,
      });

      // Сохраняем клиент под sessionId
      this.clients.set(sessionId, client);

      // Подключаемся к Telegram (storage загрузит данные при connect)
      if (!client.connected) {
        this.logger.log(`Connecting client for session ${sessionId} (phone: ${session.phoneNumber})...`);
        await client.connect();
        this.logger.log(`Client connected successfully for session ${sessionId} (phone: ${session.phoneNumber})`);
        // Эмитим событие подключения (Task 2.1)
        this.eventEmitter?.emitConnect(sessionId, session.userId, session.phoneNumber || undefined);
      }

      // КРИТИЧЕСКИ ВАЖНО: Выполняем контрольный getMe() для валидации сессии
      try {
        this.logger.debug(`Validating session ${session.id} with getMe()...`);
        const startTime = Date.now();
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        const duration = Date.now() - startTime;
        this.logger.log(`✅ Session ${session.id} validated successfully`);
        // Эмитим событие успешного invoke (Task 2.1)
        this.eventEmitter?.emitInvoke(sessionId, 'users.getFullUser', session.userId, duration);
      } catch (e: any) {
        const errorResult = handleMtprotoError(e);
        this.logger.error(`❌ Session ${session.id} validation failed: ${errorResult.reason}`);
        // Эмитим событие ошибки (Task 2.1)
        this.eventEmitter?.emitError(sessionId, e, session.userId, 'Session validation');
        
        // Проверяем на FloodWait (Task 2.1)
        if (errorResult.action === MtprotoErrorAction.RETRY && errorResult.retryAfter) {
          const floodMatch = errorResult.reason.match(/FLOOD_WAIT_(\d+)/);
          if (floodMatch) {
            const waitTime = parseInt(floodMatch[1], 10);
            this.eventEmitter?.emitFloodWait(sessionId, waitTime, session.userId, 'users.getFullUser');
          }
        }
        
        if (errorResult.action === MtprotoErrorAction.INVALIDATE_SESSION) {
          // Инвалидируем эту конкретную сессию
          session.status = 'invalid';
          session.isActive = false;
          session.invalidReason = errorResult.reason;
          await this.sessionRepository.save(session);
          
          // Отключаем и удаляем клиент из кеша
          try {
            await client.disconnect();
          } catch (disconnectError) {
            // Игнорируем ошибки отключения
          }
          this.clients.delete(sessionId);
          // Очищаем статус heartbeat для этой сессии (Task 1.2)
          this.heartbeatService?.clearHeartbeatStatus(sessionId);
          
          this.logger.warn(`Session ${sessionId} invalidated due to ${errorResult.reason}`);
          
          // Пробуем найти другую активную сессию
          const otherActiveSessions = await this.sessionRepository.find({
            where: {
              isActive: true,
              status: 'active',
            },
            order: {
              lastUsedAt: 'DESC',
            },
            take: 1,
          });
          
          if (otherActiveSessions.length > 0 && otherActiveSessions[0].id !== session.id) {
            this.logger.log(`Trying alternative session: ${otherActiveSessions[0].id}`);
            return this.getClientBySession(otherActiveSessions[0].id);
          }
          
          return null;
        }
        
        // Для других ошибок пробрасываем исключение
        throw e;
      }

      return client;
    } catch (error: any) {
      this.logger.error(`Error getting client for user ${userId}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Создает новый клиент для авторизации с DatabaseStorage
   * КРИТИЧЕСКИ ВАЖНО: Используем DatabaseStorage сразу, не StorageMemory
   * Это гарантирует, что auth_key будет сохранен правильно и не будет копирования
   */
  async createClientForAuth(userId: string, apiId: number, apiHash: string): Promise<{ client: Client; sessionId: string }> {
    this.logger.log(`Creating auth client with DatabaseStorage for user ${userId}`);
    
    // Создаем или находим сессию в БД со статусом 'initializing'
    let session = await this.sessionRepository.findOne({
      where: { userId, apiId, status: 'initializing' },
    });

    if (!session) {
      // Создаем новую сессию со статусом 'initializing'
      session = this.sessionRepository.create({
        userId,
        apiId,
        apiHash,
        encryptedSessionData: null, // Будет заполнено через DatabaseStorage
        isActive: false,
        status: 'initializing',
        invalidReason: null,
        dcId: null,
      });
      await this.sessionRepository.save(session);
      this.logger.log(`Created new initializing session ${session.id} for user ${userId}`);
    } else {
      this.logger.log(`Reusing existing initializing session ${session.id} for user ${userId}`);
    }

    // КРИТИЧНО: Создаем DatabaseStorage для этой сессии (привязан к sessionId)
    const storage = new DatabaseStorage(
      this.sessionRepository,
      this.encryptionService,
      session.id, // КРИТИЧНО: передаем sessionId, не userId
    );

    // Инициализируем storage
    await storage.initialize();

    // Создаем клиент с DatabaseStorage
    const client = new Client({
      apiId,
      apiHash,
      storage: storage as any,
    });

    // Подключаемся к Telegram
    await client.connect();
    // Эмитим событие подключения (Task 2.1)
    this.eventEmitter?.emitConnect(session.id, userId);
    
    this.logger.log(`Auth client created and connected for session ${session.id}`);
    
    return { client, sessionId: session.id };
  }

  /**
   * Сохраняет сессию после успешной авторизации
   * КРИТИЧЕСКИ ВАЖНО: Используем тот же клиент, который использовался для авторизации
   * НЕ создаем новый клиент, НЕ копируем данные - DatabaseStorage уже работает
   */
  async saveSession(
    userId: string,
    client: Client,
    sessionId: string,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string,
    expressRequest?: any, // Express request для сохранения сессии в request.session
  ): Promise<void> {
    try {
      this.logger.log(`Starting saveSession for user ${userId}, sessionId: ${sessionId}, phone: ${phoneNumber}`);
      
      // КРИТИЧНО: Проверяем, что userId совпадает (защита от ошибок в передаче параметров)
      if (!userId || typeof userId !== 'string') {
        throw new Error(`Invalid userId provided to saveSession: ${userId}`);
      }
      
      // Находим сессию в БД
      let session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // КРИТИЧНО: Проверяем, что userId сессии совпадает с переданным userId
      // Если не совпадает - это ошибка, нужно обновить userId перед активацией
      if (session.userId !== userId) {
        this.logger.warn(`[saveSession] ⚠️ userId mismatch: session.userId=${session.userId}, provided userId=${userId}. Updating session userId...`);
        session.userId = userId;
        // Сохраняем обновленный userId перед активацией
        await this.sessionRepository.save(session);
        this.logger.log(`[saveSession] ✅ Session userId updated: ${session.userId} → ${userId}`);
      }

      // КРИТИЧНО: Проверяем, что сессия в допустимом состоянии для активации
      // Только 'initializing' сессии могут быть активированы
      if (session.status !== 'initializing') {
        if (session.status === 'active') {
          this.logger.warn(`Session ${sessionId} is already active, skipping activation`);
          // Сессия уже активна - просто обновляем lastUsedAt
          session.lastUsedAt = new Date();
          await this.sessionRepository.save(session);
          this.clients.set(sessionId, client);
          return;
        }
        // Для invalid/revoked сессий - ошибка
        throw new Error(
          `Cannot activate session ${sessionId}: invalid state '${session.status}'. ` +
          `Only 'initializing' sessions can be activated.`
        );
      }

      // КРИТИЧЕСКИ ВАЖНО: Используем тот же клиент, который использовался для авторизации
      // НЕ создаем новый клиент - это нарушает lifecycle MTKruto
      // DatabaseStorage уже работает и сохраняет данные автоматически через set()
      
      // КРИТИЧЕСКИ ВАЖНО: Делаем контрольный запрос getMe() для финализации auth_key
      // Это гарантирует, что auth_key финальный и зарегистрирован в Telegram
      this.logger.debug(`Performing getMe() check for session ${sessionId} to ensure auth_key is final`);
      try {
        const startTime = Date.now();
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        const duration = Date.now() - startTime;
        this.logger.log(`✅ getMe() successful - auth_key is valid and registered for session ${sessionId}`);
        // Эмитим событие успешного invoke (Task 2.1)
        this.eventEmitter?.emitInvoke(sessionId, 'users.getFullUser', userId, duration);
      } catch (getMeError: any) {
        this.logger.error(`❌ getMe() failed for session ${sessionId}: ${getMeError.message}`);
        // Эмитим событие ошибки (Task 2.1)
        this.eventEmitter?.emitError(sessionId, getMeError, userId, 'Session save validation');
        
        // Проверяем на FloodWait (Task 2.1)
        const errorResult = handleMtprotoError(getMeError);
        if (errorResult.action === MtprotoErrorAction.RETRY && errorResult.retryAfter) {
          const floodMatch = errorResult.reason.match(/FLOOD_WAIT_(\d+)/);
          if (floodMatch) {
            const waitTime = parseInt(floodMatch[1], 10);
            this.eventEmitter?.emitFloodWait(sessionId, waitTime, userId, 'users.getFullUser');
          }
        }
        
        // Если getMe() не прошел, сессия невалидна
        session.status = 'invalid';
        session.isActive = false;
        session.invalidReason = `Session validation failed: ${getMeError.message}`;
        await this.sessionRepository.save(session);
        throw new Error(`Session validation failed: ${getMeError.message}`);
      }

      // КРИТИЧНО: Проверяем, что MTProto state записан в DatabaseStorage
      // После getMe() все данные должны быть записаны через storage.set()
      let hasAuthKey = false;
      let dcId: number | null = null;
      try {
        // Проверяем наличие auth_key - это критично для работы сессии
        const authKey = await client.storage.get(['auth_key']);
        hasAuthKey = authKey !== null && authKey !== undefined;
        
        // Получаем DC ID из сессии
        const dcValue = await client.storage.get(['dc']);
        if (dcValue && typeof dcValue === 'object' && 'dcId' in (dcValue as any)) {
          dcId = (dcValue as any).dcId;
        }
        
        this.logger.debug(`MTProto state check: hasAuthKey=${hasAuthKey}, dcId=${dcId}`);
        
        if (!hasAuthKey) {
          this.logger.error(`❌ MTProto auth_key not found in storage for session ${sessionId}`);
          // Даем небольшую задержку - возможно данные еще пишутся асинхронно
          await new Promise(resolve => setTimeout(resolve, 100));
          const retryAuthKey = await client.storage.get(['auth_key']);
          hasAuthKey = retryAuthKey !== null && retryAuthKey !== undefined;
          
          if (!hasAuthKey) {
            throw new Error(`MTProto auth_key is missing in storage. Session data may not be properly saved.`);
          }
          this.logger.log(`✅ auth_key found after retry for session ${sessionId}`);
        }
      } catch (e: any) {
        this.logger.error(`❌ Failed to verify MTProto state for session ${sessionId}: ${e.message}`);
        session.status = 'invalid';
        session.isActive = false;
        session.invalidReason = `MTProto state verification failed: ${e.message}`;
        await this.sessionRepository.save(session);
        throw new Error(`MTProto state verification failed: ${e.message}`);
      }

      // КРИТИЧНО: Перечитываем сессию из БД чтобы убедиться, что encryptedSessionData записана
      // DatabaseStorage.set() должен был записать данные через транзакцию
      const sessionWithData = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
      
      if (!sessionWithData) {
        throw new Error(`Session ${sessionId} not found after MTProto state check`);
      }
      
      // Проверяем, что encryptedSessionData не пустая
      if (!sessionWithData.encryptedSessionData || 
          sessionWithData.encryptedSessionData.trim() === '' || 
          sessionWithData.encryptedSessionData === '{}') {
        this.logger.error(`❌ encryptedSessionData is empty for session ${sessionId}`);
        // Даем небольшую задержку - возможно данные еще пишутся
        await new Promise(resolve => setTimeout(resolve, 200));
        const retrySession = await this.sessionRepository.findOne({ where: { id: sessionId } });
        
        if (!retrySession || !retrySession.encryptedSessionData || 
            retrySession.encryptedSessionData.trim() === '' || 
            retrySession.encryptedSessionData === '{}') {
          throw new Error(`encryptedSessionData is empty after retry. MTProto state may not be properly saved to DB.`);
        }
        this.logger.log(`✅ encryptedSessionData found after retry for session ${sessionId}`);
        // Обновляем ссылку на сессию
        session = retrySession;
      } else {
        this.logger.log(`✅ encryptedSessionData is present for session ${sessionId} (length: ${sessionWithData.encryptedSessionData.length})`);
      }

      // Обновляем метаданные сессии
      this.logger.debug(`Updating session ${session.id} metadata for user ${userId}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Проверяем переход состояния через SessionStateMachine
      // На этом этапе session.status === 'initializing' (проверено выше)
      this.logger.log(`[SessionStateMachine] Attempting transition: initializing → active for session ${session.id}`);
      try {
        assertSessionTransition('initializing', 'active', session.id);
        this.logger.log(`[SessionStateMachine] ✅ Transition allowed: initializing → active for session ${session.id}`);
      } catch (transitionError: any) {
        this.logger.error(`[SessionStateMachine] ❌ Transition blocked: ${transitionError.message}`);
        // Если переход запрещен, помечаем сессию как invalid
        session.status = 'invalid';
        session.isActive = false;
        session.invalidReason = `State transition blocked: ${transitionError.message}`;
        await this.sessionRepository.save(session);
        throw new Error(`Cannot activate session ${session.id}: ${transitionError.message}`);
      }
      
      session.phoneNumber = phoneNumber;
      session.isActive = true;
      session.status = 'active'; // Сессия валидна после успешного getMe()
      session.invalidReason = null; // Очищаем причину невалидности
      session.dcId = dcId;
      session.lastUsedAt = new Date();
      session.ipAddress = ipAddress || null;
      session.userAgent = userAgent || null;
      
      // КРИТИЧНО: Сохраняем сессию в БД с статусом 'active'
      // await repository.save() гарантирует завершение транзакции перед возвратом
      const savedSession = await this.sessionRepository.save(session);
      this.logger.warn(`[saveSession] 🔥 SESSION ACTIVATED: sessionId=${savedSession.id}, userId=${userId}, status=${savedSession.status}, isActive=${savedSession.isActive}`);
      this.logger.log(`✅ Session ${savedSession.id} updated successfully: initializing → active, isActive=true`);
      
      // КРИТИЧНО: После await save() транзакция завершена - проверяем, что данные действительно сохранены
      // Это защита от race condition - убеждаемся, что Guard сможет прочитать сессию сразу
      const verifySession = await this.sessionRepository.findOne({
        where: { id: savedSession.id, userId: userId }, // КРИТИЧНО: Проверяем и userId тоже
      });
      
      if (!verifySession) {
        this.logger.error(`[saveSession] ❌ CRITICAL: Session ${savedSession.id} not found in DB after save! userId=${userId}`);
        throw new Error(`Session ${savedSession.id} not found in DB immediately after save - possible race condition`);
      }
      
      // Проверяем все критичные поля
      if (verifySession.status !== 'active' || verifySession.isActive !== true || verifySession.userId !== userId) {
        this.logger.error(`[saveSession] ❌ VERIFICATION FAILED: sessionId=${verifySession.id}, status=${verifySession.status}, isActive=${verifySession.isActive}, userId=${verifySession.userId} (expected: status=active, isActive=true, userId=${userId})`);
        throw new Error(`Session verification failed: status=${verifySession.status}, isActive=${verifySession.isActive}, userId mismatch: expected=${userId}, got=${verifySession.userId}`);
      }
      
      // КРИТИЧНО: Проверяем, что encryptedSessionData не пустая (защита от пустой сессии)
      if (!verifySession.encryptedSessionData || 
          verifySession.encryptedSessionData.trim() === '' || 
          verifySession.encryptedSessionData === '{}') {
        this.logger.error(`[saveSession] ❌ CRITICAL: encryptedSessionData is empty after save! sessionId=${verifySession.id}`);
        throw new Error(`encryptedSessionData is empty after save - MTProto state was not properly saved`);
      }
      
      this.logger.warn(`[saveSession] ✅ VERIFICATION PASSED: sessionId=${verifySession.id}, status=${verifySession.status}, isActive=${verifySession.isActive}, userId=${verifySession.userId}, dataLength=${verifySession.encryptedSessionData.length}`);
      
      // Обновляем ссылку на сессию для дальнейшего использования
      session = verifySession;

      // КРИТИЧЕСКИ ВАЖНО: Сохраняем тот же клиент в кеш по sessionId
      // НЕ создаем новый клиент - используем тот, который уже прошел авторизацию
      this.clients.set(sessionId, client);

      // КРИТИЧНО: Сохраняем сессию в request.session для следующего запроса
      // Это нужно для Guard который проверяет request.session.telegramSession
      // КРИТИЧНО: userId должен совпадать с userId из JWT (request.user.sub)
      if (expressRequest) {
        // Проверяем, что userId в expressRequest совпадает с переданным userId
        const jwtUserId = expressRequest.user?.sub;
        if (jwtUserId && jwtUserId !== userId) {
          this.logger.warn(`[saveSession] ⚠️ userId mismatch: JWT userId=${jwtUserId}, provided userId=${userId}. Using JWT userId.`);
          // Используем userId из JWT для согласованности
          const correctedUserId = jwtUserId;
          this.logger.log(`[saveSession] Saving session to request.session: userId=${correctedUserId}, sessionId=${sessionId}, phoneNumber=${phoneNumber}`);
          try {
            this.telegramSessionService.save(expressRequest, {
              userId: correctedUserId, // Используем userId из JWT
              sessionId: sessionId,
              phoneNumber: phoneNumber,
              sessionData: null, // MTProto данные уже в БД через DatabaseStorage
              createdAt: Date.now(),
            });
            this.logger.log(`[saveSession] ✅ Session saved to request.session successfully: userId=${correctedUserId}, sessionId=${sessionId}`);
          } catch (error: any) {
            this.logger.error(`[saveSession] ❌ Failed to save session to request.session: ${error.message}`, error.stack);
            // НЕ пробрасываем ошибку - сессия уже в БД, это не критично
          }
        } else {
          this.logger.log(`[saveSession] Saving session to request.session: userId=${userId}, sessionId=${sessionId}, phoneNumber=${phoneNumber}, JWT userId=${jwtUserId || 'N/A'}`);
          try {
            this.telegramSessionService.save(expressRequest, {
              userId: userId,
              sessionId: sessionId,
              phoneNumber: phoneNumber,
              sessionData: null, // MTProto данные уже в БД через DatabaseStorage
              createdAt: Date.now(),
            });
            this.logger.log(`[saveSession] ✅ Session saved to request.session successfully: userId=${userId}, sessionId=${sessionId}`);
          } catch (error: any) {
            this.logger.error(`[saveSession] ❌ Failed to save session to request.session: ${error.message}`, error.stack);
            // НЕ пробрасываем ошибку - сессия уже в БД, это не критично
          }
        }
      } else {
        this.logger.warn(`[saveSession] ⚠️ expressRequest is not provided, cannot save session to request.session`);
      }

      this.logger.log(`✅ Session saved successfully for user ${userId}, session id: ${session.id}, phoneNumber: ${phoneNumber}, isActive: ${session.isActive}`);
      
      // Дополнительная проверка структуры данных (опционально, не критично)
      // Основная проверка уже выполнена выше через verifySession
      const finalCheck = await this.sessionRepository.findOne({
        where: { id: session.id },
      });
      // Эта проверка уже выполнена выше через verifySession, поэтому просто логируем успех
      if (finalCheck) {
        this.logger.log(`✅ Final verification: Session ${finalCheck.id} is confirmed in DB`);
      }
    } catch (error: any) {
      this.logger.error(`Error saving session for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Удаляет сессию пользователя
   */
  async deleteSession(userId: string): Promise<void> {
    try {
      // Находим все сессии пользователя и отключаем клиенты
      const userSessions = await this.sessionRepository.find({
        where: { userId, isActive: true },
      });
      
      for (const session of userSessions) {
        const client = this.clients.get(session.id);
        if (client) {
          await client.disconnect();
          // Эмитим событие отключения (Task 2.1)
          this.eventEmitter?.emitDisconnect(session.id, session.userId, 'Session deleted by user');
          this.clients.delete(session.id);
          // Очищаем статус heartbeat для этой сессии (Task 1.2)
          this.heartbeatService?.clearHeartbeatStatus(session.id);
          // Удаляем статус мониторинга (Task 2.3)
          this.connectionMonitorService?.removeConnectionStatus(session.id);
        }
      }

      // Деактивируем сессию в БД
      await this.sessionRepository.update(
        { userId, isActive: true },
        { isActive: false },
      );

      this.logger.log(`Session deleted for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Error deleting session for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает сессию по ID
   */
  async getSessionById(sessionId: string): Promise<TelegramUserSession | null> {
    return await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
  }

  /**
   * Обновляет сессию
   */
  async updateSession(session: TelegramUserSession): Promise<TelegramUserSession> {
    return await this.sessionRepository.save(session);
  }

  /**
   * Получает список всех активных сессий пользователя
   * Для админа возвращает все сессии в системе
   */
  async getUserSessions(userId: string): Promise<TelegramUserSession[]> {
    // Проверяем, является ли пользователь админом
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    // Если админ - возвращаем все сессии в системе (включая неактивные для просмотра)
    if (user?.role === UserRole.ADMIN) {
      return await this.sessionRepository.find({
        order: { lastUsedAt: 'DESC', createdAt: 'DESC' },
        relations: ['user'], // Загружаем информацию о пользователе
      });
    }

    // Для обычных пользователей - только их сессии (включая неактивные)
    return await this.sessionRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Полностью удаляет сессию из БД (не только деактивирует)
   * Админ может удалить любую сессию в системе
   */
  async removeSession(userId: string, sessionId: string): Promise<void> {
    // Проверяем, является ли пользователь админом
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    // Ищем сессию
    let session: TelegramUserSession | null;
    if (user?.role === UserRole.ADMIN) {
      // Админ может удалить любую сессию
      session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
    } else {
      // Обычный пользователь может удалить только свою сессию
      session = await this.sessionRepository.findOne({
        where: { id: sessionId, userId },
      });
    }

    if (!session) {
      throw new Error('Session not found');
    }

    // Отключаем клиент, если он активен (используем sessionId для кеша)
    const client = this.clients.get(sessionId);
    if (client) {
      try {
        await client.disconnect();
        // Эмитим событие отключения (Task 2.1)
        this.eventEmitter?.emitDisconnect(sessionId, session.userId, 'Session removed');
      } catch (e) {
        this.logger.warn(`Error disconnecting client for session ${sessionId}: ${(e as Error).message}`);
        // Эмитим событие ошибки при отключении (Task 2.1)
        this.eventEmitter?.emitError(sessionId, e as Error, session.userId, 'Session remove disconnect');
      }
      this.clients.delete(sessionId);
      // Очищаем статус heartbeat для этой сессии (Task 1.2)
      this.heartbeatService?.clearHeartbeatStatus(sessionId);
      // Удаляем статус мониторинга (Task 2.3)
      this.connectionMonitorService?.removeConnectionStatus(sessionId);
    }

    // Полностью удаляем сессию из БД
    await this.sessionRepository.remove(session);

    this.logger.log(`Session ${sessionId} completely removed from database`);
  }

  /**
   * Инвалидирует все активные сессии (используется при AUTH_KEY_UNREGISTERED)
   */
  async invalidateAllSessions(reason: string = 'AUTH_KEY_UNREGISTERED'): Promise<void> {
    try {
      const activeSessions = await this.sessionRepository.find({
        where: { isActive: true, status: 'active' },
      });

      for (const session of activeSessions) {
        // Отключаем клиент, если он активен (используем sessionId для кеша)
        const client = this.clients.get(session.id);
        if (client) {
          try {
            await client.disconnect();
            // Эмитим событие отключения (Task 2.1)
            this.eventEmitter?.emitDisconnect(session.id, session.userId, reason);
          } catch (e) {
            this.logger.warn(`Error disconnecting client for session ${session.id}: ${(e as Error).message}`);
            // Эмитим событие ошибки при отключении (Task 2.1)
            this.eventEmitter?.emitError(session.id, e as Error, session.userId, 'Invalidate all sessions disconnect');
          }
          this.clients.delete(session.id);
          // Очищаем статус heartbeat для этой сессии (Task 1.2)
          this.heartbeatService?.clearHeartbeatStatus(session.id);
          // Удаляем статус мониторинга (Task 2.3)
          this.connectionMonitorService?.removeConnectionStatus(session.id);
        }

        // Инвалидируем сессию с указанием причины
        session.isActive = false;
        session.status = 'invalid';
        session.invalidReason = reason;
        await this.sessionRepository.save(session);
      }

      this.logger.log(`Invalidated ${activeSessions.length} active session(s) due to ${reason}`);
    } catch (error: any) {
      this.logger.error(`Error invalidating sessions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает клиент по конкретной сессии (детерминированный метод)
   */
  async getClientBySession(sessionId: string): Promise<Client | null> {
    try {
      this.logger.log(`Getting client for specific session: ${sessionId}`);

      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`Session ${sessionId} not found`);
        return null;
      }

      // Проверяем статус сессии
      if (session.status !== 'active' || !session.isActive) {
        this.logger.warn(`Session ${sessionId} is not active (status: ${session.status}, isActive: ${session.isActive})`);
        return null;
      }

      // Проверяем, что сессия имеет валидные данные
      // Для активных сессий данные должны быть валидны
      if (!this.isSessionDataValid(session.encryptedSessionData)) {
        this.logger.error(`Session ${sessionId} has empty or invalid encryptedSessionData`);
        return null;
      }

      // КРИТИЧЕСКИ ВАЖНО: Используем sessionId для кеша, не userId
      // Проверяем, есть ли уже активный клиент для этой сессии
      if (this.clients.has(sessionId)) {
        const client = this.clients.get(sessionId)!;
        if (client.connected) {
          this.logger.debug(`Using cached client for session ${sessionId} - skipping getMe() validation`);
          // КРИТИЧНО: Если клиент из кеша и подключен, не делаем getMe()
          // getMe() уже был выполнен при создании клиента из БД
          // Это оптимизация - избегаем лишних RPC вызовов
          return client;
        }
        // КРИТИЧНО: Lazy reconnection - если клиент отключен, удаляем его из кеша
        // Новое соединение будет создано ниже при необходимости
        // Это автоматическое переподключение при обнаружении disconnect (Task 3)
        this.logger.warn(`Client for session ${sessionId} is disconnected, will recreate connection`);
        this.clients.delete(sessionId);
        // Очищаем статус heartbeat для этой сессии (Task 1.2)
        this.heartbeatService?.clearHeartbeatStatus(sessionId);
      }

      // Получаем API credentials
      const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      const apiId = parseInt(apiIdStr, 10);
      if (isNaN(apiId)) {
        throw new Error('TELEGRAM_API_ID must be a valid number');
      }

      // КРИТИЧНО: Создаем Storage адаптер привязанный к sessionId
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        session.id, // КРИТИЧНО: передаем sessionId, не userId
      );

      // Инициализируем storage
      await storage.initialize();

      // Создаем клиент
      const client = new Client({
        apiId,
        apiHash,
        storage: storage as any,
      });

      // КРИТИЧЕСКИ ВАЖНО: Сохраняем клиент под sessionId, не userId
      this.clients.set(sessionId, client);

      // Подключаемся к Telegram
      // КРИТИЧНО: Lazy reconnection - переподключение при обнаружении disconnect (Task 3)
      if (!client.connected) {
        this.logger.log(`Connecting client for session ${sessionId} (userId: ${session.userId}, phone: ${session.phoneNumber})...`);
        await client.connect();
        this.logger.log(`Client connected successfully for session ${sessionId}`);
        // Эмитим событие подключения (Task 2.1)
        this.eventEmitter?.emitConnect(sessionId, session.userId, session.phoneNumber || undefined);
      }

      // КРИТИЧЕСКИ ВАЖНО: Выполняем контрольный getMe() для валидации сессии
      try {
        this.logger.debug(`Validating session ${sessionId} with getMe()...`);
        const startTime = Date.now();
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        const duration = Date.now() - startTime;
        this.logger.log(`✅ Session ${sessionId} validated successfully`);
        // Эмитим событие успешного invoke (Task 2.1)
        this.eventEmitter?.emitInvoke(sessionId, 'users.getFullUser', session.userId, duration);
      } catch (e: any) {
        const errorResult = handleMtprotoError(e);
        this.logger.error(`❌ Session ${sessionId} validation failed: ${errorResult.reason}`);
        // Эмитим событие ошибки (Task 2.1)
        this.eventEmitter?.emitError(sessionId, e, session.userId, 'Session validation');
        
        // Проверяем на FloodWait (Task 2.1)
        if (errorResult.action === MtprotoErrorAction.RETRY && errorResult.retryAfter) {
          const floodMatch = errorResult.reason.match(/FLOOD_WAIT_(\d+)/);
          if (floodMatch) {
            const waitTime = parseInt(floodMatch[1], 10);
            this.eventEmitter?.emitFloodWait(sessionId, waitTime, session.userId, 'users.getFullUser');
          }
        }
        
        if (errorResult.action === MtprotoErrorAction.INVALIDATE_SESSION) {
          // Инвалидируем эту конкретную сессию
          session.status = 'invalid';
          session.isActive = false;
          session.invalidReason = errorResult.reason;
          await this.sessionRepository.save(session);
          
          // Отключаем и удаляем клиент из кеша
          try {
            await client.disconnect();
            // Эмитим событие отключения (Task 2.1)
            this.eventEmitter?.emitDisconnect(sessionId, session.userId, errorResult.reason);
          } catch (disconnectError) {
            // Игнорируем ошибки отключения
          }
          this.clients.delete(sessionId);
          // Очищаем статус heartbeat для этой сессии (Task 1.2)
          this.heartbeatService?.clearHeartbeatStatus(sessionId);
          
          this.logger.warn(`Session ${sessionId} invalidated due to ${errorResult.reason}`);
          return null;
        }
        
        // Для других ошибок пробрасываем исключение
        throw e;
      }

      return client;
    } catch (error: any) {
      this.logger.error(`Error getting client for session ${sessionId}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Деактивирует конкретную сессию по ID
   * Админ может деактивировать любую сессию в системе
   */
  async deactivateSession(userId: string, sessionId: string): Promise<void> {
    // Проверяем, является ли пользователь админом
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    // Ищем сессию
    let session: TelegramUserSession | null;
    if (user?.role === UserRole.ADMIN) {
      // Админ может деактивировать любую сессию
      session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });
    } else {
      // Обычный пользователь может деактивировать только свою сессию
      session = await this.sessionRepository.findOne({
        where: { id: sessionId, userId },
      });
    }

    if (!session) {
      throw new Error('Session not found');
    }

    // Если это текущая активная сессия, отключаем клиент (используем sessionId для кеша)
    if (session.isActive) {
      const client = this.clients.get(sessionId);
      if (client) {
        await client.disconnect();
        // Эмитим событие отключения (Task 2.1)
        this.eventEmitter?.emitDisconnect(sessionId, session.userId, 'Deactivated by user');
        this.clients.delete(sessionId);
        // Очищаем статус heartbeat для этой сессии (Task 1.2)
        this.heartbeatService?.clearHeartbeatStatus(sessionId);
        // Удаляем статус мониторинга (Task 2.3)
        this.connectionMonitorService?.removeConnectionStatus(sessionId);
      }
    }

    // Деактивируем сессию в БД
    session.isActive = false;
    if (session.status === 'active') {
      session.status = 'invalid';
      session.invalidReason = 'Deactivated by user';
    }
    await this.sessionRepository.save(session);

    this.logger.log(`Session ${sessionId} deactivated by user ${userId} (session owner: ${session.userId}, status: ${session.status})`);
  }

  /**
   * Деактивирует все сессии пользователя кроме текущей
   */
  async deactivateOtherSessions(userId: string, currentSessionId?: string): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
    });

    for (const session of sessions) {
      if (!currentSessionId || session.id !== currentSessionId) {
        session.isActive = false;
        await this.sessionRepository.save(session);
      }
    }

    this.logger.log(`All other sessions deactivated for user ${userId}`);
  }

  /**
   * Проверяет валидность данных сессии
   * @param encryptedSessionData Зашифрованные данные сессии
   * @returns true если данные валидны, false иначе
   */
  private isSessionDataValid(encryptedSessionData: string | null): boolean {
    if (!encryptedSessionData) {
      return false; // null допустим только в статусе initializing
    }
    
    const trimmed = encryptedSessionData.trim();
    if (trimmed === '' || trimmed === '{}') {
      return false; // Пустые данные недопустимы
    }
    
    try {
      // Пытаемся расшифровать и проверить структуру
      const decrypted = this.encryptionService.decrypt(encryptedSessionData);
      if (!decrypted || decrypted.trim() === '' || decrypted === '{}') {
        return false;
      }
      
      const data = JSON.parse(decrypted);
      
      // Проверяем наличие критических ключей
      const hasAuthKey = data.auth_key && typeof data.auth_key === 'string' && data.auth_key.length > 0;
      const hasDc = data.dc !== undefined;
      
      return hasAuthKey && hasDc;
    } catch {
      return false; // Ошибка расшифровки/парсинга = невалидные данные
    }
  }

  /**
   * Отключает все клиенты при остановке модуля
   */
  async onModuleDestroy() {
    this.logger.log('Disconnecting all Telegram user clients...');
    const sessionIds = Array.from(this.clients.keys());
    for (const [sessionId, client] of this.clients.entries()) {
      try {
        // Получаем userId из сессии для эмита события
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        const userId = session?.userId || 'unknown';
        
        await client.disconnect();
        // Эмитим событие отключения (Task 2.1)
        this.eventEmitter?.emitDisconnect(sessionId, userId, 'Module destroyed');
        this.logger.log(`Client disconnected for session ${sessionId}`);
      } catch (error: any) {
        this.logger.error(`Error disconnecting client for session ${sessionId}: ${error.message}`);
        // Эмитим событие ошибки при отключении (Task 2.1)
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } }).catch(() => null);
        this.eventEmitter?.emitError(sessionId, error, session?.userId, 'Module destroy disconnect');
      }
      // Очищаем статус heartbeat для этой сессии (Task 1.2)
      this.heartbeatService?.clearHeartbeatStatus(sessionId);
    }
    this.clients.clear();
  }
}

