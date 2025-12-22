import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, Storage, StorageKeyPart } from '@mtkruto/node';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { SessionEncryptionService } from './session-encryption.service';
import { User, UserRole } from '../../../entities/user.entity';
import { handleMtprotoError, MtprotoErrorAction } from '../utils/mtproto-error.handler';

/**
 * Кастомный Storage адаптер для MTKruto, который сохраняет сессии в БД с шифрованием
 */
// @ts-ignore - временно игнорируем ошибку типов Storage
class DatabaseStorage implements Partial<Storage> {
  constructor(
    private sessionRepository: Repository<TelegramUserSession>,
    private encryptionService: SessionEncryptionService,
    private userId: string,
    private apiId: number,
    private apiHash: string,
  ) {}

  async initialize(): Promise<void> {
    // Инициализация storage - ничего не делаем, так как данные уже в БД
    return Promise.resolve();
  }

  async get<T = Uint8Array>(key: readonly StorageKeyPart[]): Promise<T | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          userId: this.userId,
          apiId: this.apiId,
          isActive: true,
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

  async set(key: readonly StorageKeyPart[], value: any): Promise<void> {
    try {
      let session = await this.sessionRepository.findOne({
        where: {
          userId: this.userId,
          apiId: this.apiId,
        },
      });

      let data: any = {};

      if (session && session.encryptedSessionData) {
        try {
          // Проверяем, что данные не пустые
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
      
      // Обрабатываем разные типы данных, которые может сохранять MTKruto
      if (value instanceof Uint8Array) {
        // Бинарные данные (auth_key, server_salt и т.д.) - сохраняем как base64
        current[lastKey] = Buffer.from(value).toString('base64');
      } else if (typeof value === 'bigint') {
        // BigInt нельзя сериализовать в JSON напрямую - конвертируем в строку
        current[lastKey] = value.toString();
      } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) {
        // Примитивные типы - сохраняем как есть
        current[lastKey] = value;
      } else {
        // Для других типов пытаемся сериализовать
        // Если это объект, который можно сериализовать - сохраняем как JSON
        try {
          current[lastKey] = JSON.parse(JSON.stringify(value));
        } catch {
          // Если не удалось сериализовать - конвертируем в строку
          current[lastKey] = String(value);
        }
      }

      const encrypted = this.encryptionService.encrypt(JSON.stringify(data));

      if (session) {
        session.encryptedSessionData = encrypted;
        session.lastUsedAt = new Date();
        // Убеждаемся, что сессия активна
        if (!session.isActive) {
          session.isActive = true;
        }
        await this.sessionRepository.save(session);
      } else {
        // Создаем новую сессию, если её еще нет
        session = this.sessionRepository.create({
          userId: this.userId,
          apiId: this.apiId,
          apiHash: this.apiHash,
          encryptedSessionData: encrypted,
          isActive: true,
          lastUsedAt: new Date(),
        });
        await this.sessionRepository.save(session);
      }
    } catch (error: any) {
      throw new Error(`Failed to save session data: ${error.message}`);
    }
  }

  async delete(key: readonly StorageKeyPart[]): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          userId: this.userId,
          apiId: this.apiId,
        },
      });

      if (!session) {
        return;
      }

      const decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
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
          userId: this.userId,
          apiId: this.apiId,
          isActive: true,
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
              
              // Обрабатываем разные типы данных
              if (typeof value === 'string') {
                // Проверяем, является ли это base64 строкой (бинарные данные)
                if (value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
                  try {
                    const decoded = Buffer.from(value, 'base64');
                    const uint8Array = new Uint8Array(decoded) as T;
                    results.push([fullPath, uint8Array]);
                  } catch {
                    // Если не base64, пропускаем
                  }
                } else {
                  // Обычная строка или BigInt сохраненный как строка - возвращаем как есть
                  results.push([fullPath, value as T]);
                }
              } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                // Примитивные типы - возвращаем как есть
                results.push([fullPath, value as T]);
              } else if (Array.isArray(value)) {
                // Массив чисел (старый формат) - конвертируем в Uint8Array
                const uint8Array = new Uint8Array(value) as T;
                results.push([fullPath, uint8Array]);
              } else if (value instanceof Uint8Array) {
                // Уже Uint8Array - возвращаем как есть
                results.push([fullPath, value as T]);
              } else if (typeof value === 'object') {
                // Объекты - рекурсивно обрабатываем
                const nestedResults = findKeys(value, [...fullPath] as StorageKeyPart[]);
                results.push(...nestedResults);
              } else if (Array.isArray(value)) {
                // Старый формат (массив чисел) - конвертируем в Uint8Array
                const uint8Array = new Uint8Array(value) as T;
                results.push([fullPath, uint8Array]);
              }
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
  ) {
    this.logger.log('TelegramUserClientService initialized');
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
   * Получает клиент по userId (для обратной совместимости)
   * ВАЖНО: Этот метод будет удален в будущем, используйте getClient(sessionId)
   */
  async getClientByUserId(userId: string): Promise<Client | null> {
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

      // Создаем Storage адаптер с userId из сессии
      // Storage будет загружать данные из БД при вызове get/getMany
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        session.userId, // Используем userId из сессии для DatabaseStorage
        apiId,
        apiHash,
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
      }

      // КРИТИЧЕСКИ ВАЖНО: Выполняем контрольный getMe() для валидации сессии
      try {
        this.logger.debug(`Validating session ${session.id} with getMe()...`);
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        this.logger.log(`✅ Session ${session.id} validated successfully`);
      } catch (e: any) {
        const errorResult = handleMtprotoError(e);
        this.logger.error(`❌ Session ${session.id} validation failed: ${errorResult.reason}`);
        
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

    // Создаем DatabaseStorage для этой сессии
    const storage = new DatabaseStorage(
      this.sessionRepository,
      this.encryptionService,
      userId,
      apiId,
      apiHash,
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
  ): Promise<void> {
    try {
      this.logger.log(`Starting saveSession for user ${userId}, sessionId: ${sessionId}, phone: ${phoneNumber}`);
      
      // Находим сессию в БД
      let session = await this.sessionRepository.findOne({
        where: { id: sessionId, userId },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found for user ${userId}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Используем тот же клиент, который использовался для авторизации
      // НЕ создаем новый клиент - это нарушает lifecycle MTKruto
      // DatabaseStorage уже работает и сохраняет данные автоматически через set()
      
      // КРИТИЧЕСКИ ВАЖНО: Делаем контрольный запрос getMe() для финализации auth_key
      // Это гарантирует, что auth_key финальный и зарегистрирован в Telegram
      this.logger.debug(`Performing getMe() check for session ${sessionId} to ensure auth_key is final`);
      try {
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        this.logger.log(`✅ getMe() successful - auth_key is valid and registered for session ${sessionId}`);
      } catch (getMeError: any) {
        this.logger.error(`❌ getMe() failed for session ${sessionId}: ${getMeError.message}`);
        // Если getMe() не прошел, сессия невалидна
        session.status = 'invalid';
        session.isActive = false;
        session.invalidReason = `Session validation failed: ${getMeError.message}`;
        await this.sessionRepository.save(session);
        throw new Error(`Session validation failed: ${getMeError.message}`);
      }

      // Получаем DC ID из сессии для сохранения
      let dcId: number | null = null;
      try {
        const dcValue = await client.storage.get(['dc']);
        if (dcValue && typeof dcValue === 'object' && 'dcId' in (dcValue as any)) {
          dcId = (dcValue as any).dcId;
        }
      } catch (e) {
        this.logger.debug(`Could not extract DC ID: ${(e as Error).message}`);
      }

      // Обновляем метаданные сессии
      this.logger.debug(`Updating session ${session.id} metadata for user ${userId}`);
      session.phoneNumber = phoneNumber;
      session.isActive = true;
      session.status = 'active'; // Сессия валидна после успешного getMe()
      session.invalidReason = null; // Очищаем причину невалидности
      session.dcId = dcId;
      session.lastUsedAt = new Date();
      session.ipAddress = ipAddress || null;
      session.userAgent = userAgent || null;
      await this.sessionRepository.save(session);
      this.logger.debug(`Session ${session.id} updated successfully with status=active`);

      // КРИТИЧЕСКИ ВАЖНО: Сохраняем тот же клиент в кеш по sessionId
      // НЕ создаем новый клиент - используем тот, который уже прошел авторизацию
      this.clients.set(sessionId, client);

      this.logger.log(`✅ Session saved successfully for user ${userId}, session id: ${session.id}, phoneNumber: ${phoneNumber}, isActive: ${session.isActive}`);
      
      // Проверяем, что сессия действительно сохранена и активна
      const savedSession = await this.sessionRepository.findOne({
        where: { id: session.id },
      });
      if (savedSession) {
        // Проверяем, что в сессии есть данные (не пустые)
        let hasData = false;
        let dataSize = 0;
        try {
          if (savedSession.encryptedSessionData && savedSession.encryptedSessionData.trim() !== '' && savedSession.encryptedSessionData !== '{}') {
            const decrypted = this.encryptionService.decrypt(savedSession.encryptedSessionData);
            if (decrypted && decrypted.trim() !== '' && decrypted !== '{}') {
              const data = JSON.parse(decrypted);
              // Проверяем наличие критических ключей
              const hasAuthKey = data.auth_key && Array.isArray(data.auth_key) && data.auth_key.length > 0;
              const hasDc = data.dc !== undefined;
              const hasServerSalt = data.server_salt && Array.isArray(data.server_salt) && data.server_salt.length > 0;
              hasData = hasAuthKey && hasDc && hasServerSalt;
              dataSize = decrypted.length;
              
              this.logger.log(`✅ Verified saved session: id=${savedSession.id}, isActive=${savedSession.isActive}, phoneNumber=${savedSession.phoneNumber}, userId=${savedSession.userId}`);
              this.logger.log(`📊 Session data check: hasAuthKey=${hasAuthKey}, authKeyLength=${hasAuthKey ? data.auth_key.length : 0}, hasDc=${hasDc}, dc=${data.dc || 'N/A'}, hasServerSalt=${hasServerSalt}, dataSize=${dataSize} bytes`);
              
              if (!hasData) {
                this.logger.error(`❌ CRITICAL: Session ${savedSession.id} has empty or invalid session data! Missing critical keys.`);
              }
            } else {
              this.logger.error(`❌ CRITICAL: Session ${savedSession.id} has empty decrypted data!`);
            }
          } else {
            this.logger.error(`❌ CRITICAL: Session ${savedSession.id} has empty encryptedSessionData!`);
          }
        } catch (e) {
          this.logger.error(`❌ CRITICAL: Failed to verify session data for ${savedSession.id}: ${(e as Error).message}`);
        }
      } else {
        this.logger.error(`❌ ERROR: Session ${session.id} was not found in database after saving!`);
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
          this.clients.delete(session.id);
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
      } catch (e) {
        this.logger.warn(`Error disconnecting client for session ${sessionId}: ${(e as Error).message}`);
      }
      this.clients.delete(sessionId);
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
          } catch (e) {
            this.logger.warn(`Error disconnecting client for session ${session.id}: ${(e as Error).message}`);
          }
          this.clients.delete(session.id);
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
      if (!session.encryptedSessionData || session.encryptedSessionData === '{}' || session.encryptedSessionData.trim() === '') {
        this.logger.error(`Session ${sessionId} has empty or invalid encryptedSessionData`);
        return null;
      }

      // КРИТИЧЕСКИ ВАЖНО: Используем sessionId для кеша, не userId
      // Проверяем, есть ли уже активный клиент для этой сессии
      if (this.clients.has(sessionId)) {
        const client = this.clients.get(sessionId)!;
        if (client.connected) {
          this.logger.debug(`Using cached client for session ${sessionId}`);
          return client;
        }
        // Если клиент отключен, удаляем его
        this.clients.delete(sessionId);
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

      // Создаем Storage адаптер с userId из сессии
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        session.userId,
        apiId,
        apiHash,
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
      if (!client.connected) {
        this.logger.log(`Connecting client for session ${sessionId} (userId: ${session.userId}, phone: ${session.phoneNumber})...`);
        await client.connect();
        this.logger.log(`Client connected successfully for session ${sessionId}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Выполняем контрольный getMe() для валидации сессии
      try {
        this.logger.debug(`Validating session ${sessionId} with getMe()...`);
        await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
        this.logger.log(`✅ Session ${sessionId} validated successfully`);
      } catch (e: any) {
        const errorResult = handleMtprotoError(e);
        this.logger.error(`❌ Session ${sessionId} validation failed: ${errorResult.reason}`);
        
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
        this.clients.delete(sessionId);
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
   * Отключает все клиенты при остановке модуля
   */
  async onModuleDestroy() {
    this.logger.log('Disconnecting all Telegram user clients...');
    for (const [sessionId, client] of this.clients.entries()) {
      try {
        await client.disconnect();
        this.logger.log(`Client disconnected for session ${sessionId}`);
      } catch (error: any) {
        this.logger.error(`Error disconnecting client for session ${sessionId}: ${error.message}`);
      }
    }
    this.clients.clear();
  }
}

