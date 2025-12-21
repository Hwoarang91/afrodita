import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, Storage, StorageKeyPart, StorageMemory } from '@mtkruto/node';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { SessionEncryptionService } from './session-encryption.service';
import { User, UserRole } from '../../../entities/user.entity';

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

      if (typeof current === 'string') {
        return new TextEncoder().encode(current) as T;
      }

      return (current instanceof Uint8Array ? current : null) as T | null;
    } catch (error) {
      return null;
    }
  }

  async set(key: readonly StorageKeyPart[], value: Uint8Array): Promise<void> {
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
      current[lastKey] = Array.from(value);

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
              
              if (Array.isArray(value)) {
                // Конвертируем массив обратно в Uint8Array
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
  private clients: Map<string, Client> = new Map(); // userId -> Client

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
   * Получает или создает MTProto клиент для пользователя
   * Ищет сессию по телефону или telegramId пользователя, а не по userId админа
   */
  async getClient(userId: string): Promise<Client | null> {
    try {
      // Получаем пользователя из БД для проверки телефона и telegramId
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return null;
      }

      this.logger.debug(`Looking for session for user ${userId} (telegramId: ${user.telegramId || 'none'}, phone: ${user.phone || 'none'}, email: ${user.email || 'none'}, role: ${user.role})`);

      // Ищем сессию по телефону пользователя (основной способ)
      let session = null;
      if (user.phone) {
        session = await this.sessionRepository.findOne({
          where: {
            phoneNumber: user.phone,
            isActive: true,
          },
          order: {
            lastUsedAt: 'DESC', // Берем последнюю использованную сессию
          },
        });

        if (session) {
          this.logger.debug(`Found session for user ${userId} via phone ${user.phone} (session userId: ${session.userId}, session id: ${session.id})`);
        } else {
          this.logger.debug(`No session found for user ${userId} via phone ${user.phone}`);
        }
      } else {
        this.logger.debug(`User ${userId} has no phone number, skipping phone search`);
      }

      // Если сессия не найдена по телефону, ищем по telegramId
      if (!session && user.telegramId) {
        // Находим пользователя с таким telegramId (может быть другой пользователь)
        const telegramUser = await this.userRepository.findOne({
          where: { telegramId: user.telegramId },
        });

        if (telegramUser) {
          session = await this.sessionRepository.findOne({
            where: {
              userId: telegramUser.id,
              isActive: true,
            },
            order: {
              lastUsedAt: 'DESC',
            },
          });

          if (session) {
            this.logger.debug(`Found session for user ${userId} via telegramId ${user.telegramId} (session userId: ${session.userId}, session id: ${session.id})`);
          } else {
            this.logger.debug(`No session found for user ${userId} via telegramId ${user.telegramId}`);
          }
        } else {
          this.logger.debug(`No user found with telegramId ${user.telegramId}`);
        }
      } else if (!session && !user.telegramId) {
        this.logger.debug(`User ${userId} has no telegramId, skipping telegramId search`);
      }

      // Если админ и сессия не найдена, ищем любую активную сессию (для админов)
      if (!session && user.role === UserRole.ADMIN) {
        this.logger.debug(`User ${userId} is ADMIN, searching for any active session`);
        const activeSessions = await this.sessionRepository.find({
          where: {
            isActive: true,
          },
          order: {
            lastUsedAt: 'DESC',
          },
        });
        
        this.logger.debug(`Found ${activeSessions.length} active session(s) in database`);
        if (activeSessions.length > 0) {
          activeSessions.forEach((s, index) => {
            this.logger.debug(`Active session ${index + 1}: userId=${s.userId}, phoneNumber=${s.phoneNumber}, id=${s.id}, lastUsedAt=${s.lastUsedAt}`);
          });
          session = activeSessions[0]; // Берем первую (самую свежую)
          this.logger.debug(`Using active session for admin ${userId} (session userId: ${session.userId}, phone: ${session.phoneNumber}, session id: ${session.id})`);
        } else {
          this.logger.debug(`No active sessions found in database for admin ${userId}`);
        }
      } else if (!session && user.role !== UserRole.ADMIN) {
        this.logger.debug(`User ${userId} is not ADMIN (role: ${user.role}), skipping admin session search`);
      }

      if (!session) {
        this.logger.warn(
          `No active session found for user ${userId} (telegramId: ${user.telegramId || 'none'}, phone: ${user.phone || 'none'}, role: ${user.role || 'none'})`
        );
        return null;
      }

      // Используем userId из найденной сессии (может отличаться от userId запроса)
      const sessionUserId = session.userId;
      
      // Проверяем, есть ли уже активный клиент для этой сессии
      if (this.clients.has(sessionUserId)) {
        const client = this.clients.get(sessionUserId)!;
        if (client.connected) {
          this.logger.debug(`Using cached client for session userId ${sessionUserId}`);
          return client;
        }
        // Если клиент отключен, удаляем его
        this.clients.delete(sessionUserId);
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
        sessionUserId, // Используем userId из сессии
        apiId,
        apiHash,
      );

      // Создаем клиент
      // @ts-ignore - временно игнорируем ошибку типов Storage
      const client = new Client({
        apiId,
        apiHash,
        storage: storage as any,
      });

      // Сохраняем клиент под sessionUserId (не под userId запроса)
      this.clients.set(sessionUserId, client);

      // Подключаемся к Telegram
      if (!client.connected) {
        await client.connect();
        this.logger.log(`Client connected for user ${userId}`);
      }

      return client;
    } catch (error: any) {
      this.logger.error(`Error getting client for user ${userId}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Создает новый клиент для авторизации (без сохраненной сессии)
   * Использует StorageMemory с методами getMany, setMany, delete для совместимости
   */
  async createClientForAuth(apiId: number, apiHash: string): Promise<Client> {
    // Используем StorageMemory, который имеет все необходимые методы
    const storage = new StorageMemory();
    
    const client = new Client({
      apiId,
      apiHash,
      storage: storage as any,
    });

    await client.connect();
    return client;
  }

  /**
   * Сохраняет сессию после успешной авторизации
   * Создает новый клиент с нашим DatabaseStorage и копирует данные сессии
   */
  async saveSession(
    userId: string,
    client: Client,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Starting saveSession for user ${userId}, phone: ${phoneNumber}`);
      
      const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set');
      }

      const apiId = parseInt(apiIdStr, 10);
      if (isNaN(apiId)) {
        throw new Error('TELEGRAM_API_ID must be a valid number');
      }

      this.logger.debug(`Creating DatabaseStorage for user ${userId}, apiId: ${apiId}`);

      // Создаем наш DatabaseStorage для этого пользователя
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        userId,
        apiId,
        apiHash,
      );

      // ВАЖНО: Сначала копируем данные сессии напрямую в DatabaseStorage
      // Это сохранит их в БД до создания нового клиента
      this.logger.debug(`Copying session data to DatabaseStorage for user ${userId}`);
      await this.copySessionDataToStorage(client, storage);
      this.logger.debug(`Session data copied successfully for user ${userId}`);

      // Создаем новый клиент с нашим storage (данные уже в БД)
      this.logger.debug(`Creating new Client with DatabaseStorage for user ${userId}`);
      const newClient = new Client({
        apiId,
        apiHash,
        storage: storage as any,
      });

      // Подключаем новый клиент (он загрузит данные из нашего storage)
      this.logger.debug(`Connecting new client for user ${userId}`);
      await newClient.connect();
      this.logger.debug(`New client connected successfully for user ${userId}`);

      // Сохраняем метаданные сессии в БД
      this.logger.debug(`Saving session metadata for user ${userId}`);
      let session = await this.sessionRepository.findOne({
        where: { userId, apiId },
      });

      if (session) {
        this.logger.debug(`Updating existing session ${session.id} for user ${userId}`);
        session.phoneNumber = phoneNumber;
        session.isActive = true;
        session.lastUsedAt = new Date();
        session.ipAddress = ipAddress || null;
        session.userAgent = userAgent || null;
        await this.sessionRepository.save(session);
        this.logger.debug(`Session ${session.id} updated successfully`);
      } else {
        this.logger.debug(`Creating new session for user ${userId}`);
        session = this.sessionRepository.create({
          userId,
          apiId,
          apiHash,
          encryptedSessionData: this.encryptionService.encrypt('{}'), // Пустые данные, storage уже работает
          phoneNumber,
          isActive: true,
          lastUsedAt: new Date(),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        });
        await this.sessionRepository.save(session);
        this.logger.debug(`New session ${session.id} created successfully`);
      }

      // Отключаем старый клиент и сохраняем новый в кэше
      try {
        await client.disconnect();
      } catch (e) {
        this.logger.warn(`Error disconnecting old client: ${(e as Error).message}`);
      }

      this.clients.set(userId, newClient);

      this.logger.log(`Session saved successfully for user ${userId}, session id: ${session.id}`);
    } catch (error: any) {
      this.logger.error(`Error saving session for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Копирует данные сессии из клиента напрямую в DatabaseStorage
   * Это сохраняет данные в БД до создания нового клиента
   */
  private async copySessionDataToStorage(sourceClient: Client, targetStorage: DatabaseStorage): Promise<void> {
    try {
      // Получаем storage исходного клиента
      const sourceStorage = (sourceClient as any).storage as Storage;

      // Проверяем, что sourceStorage имеет метод get
      if (!sourceStorage || typeof sourceStorage.get !== 'function') {
        this.logger.warn('Source storage does not have get method, skipping copy');
        return;
      }

      // MTKruto хранит сессию в определенных ключах
      // Основные ключи для сессии (из документации MTKruto):
      const sessionKeys: readonly StorageKeyPart[][] = [
        ['dc'],
        ['auth_key'],
        ['auth_key_id'],
        ['server_salt'],
        ['session_id'],
        ['takeout_id'],
      ];

      // Копируем данные по каждому ключу напрямую в DatabaseStorage
      // Это сохранит их в БД через метод set
      let copiedCount = 0;
      for (const key of sessionKeys) {
        try {
          const value = await sourceStorage.get(key);
          if (value && value.length > 0) {
            await targetStorage.set(key, value as Uint8Array);
            copiedCount++;
            this.logger.debug(`Copied session key to DatabaseStorage: ${key.join('.')} (${value.length} bytes)`);
          }
        } catch (e) {
          // Игнорируем ошибки для отдельных ключей, но логируем
          this.logger.warn(`Failed to copy key ${key.join('.')}: ${(e as Error).message}`);
        }
      }

      // Также копируем данные о DC (datacenter)
      // MTKruto может хранить несколько DC (обычно 1-5)
      for (let dcId = 1; dcId <= 5; dcId++) {
        try {
          const dcKey: readonly StorageKeyPart[] = ['dc', dcId.toString()];
          const value = await sourceStorage.get(dcKey);
          if (value && value.length > 0) {
            await targetStorage.set(dcKey, value as Uint8Array);
            copiedCount++;
            this.logger.debug(`Copied DC key to DatabaseStorage: ${dcKey.join('.')} (${value.length} bytes)`);
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      if (copiedCount === 0) {
        this.logger.warn('No session keys were copied - session may be empty');
      } else {
        this.logger.log(`Copied ${copiedCount} session keys to DatabaseStorage successfully`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to copy session data to DatabaseStorage: ${error.message}`, error.stack);
      // Бросаем ошибку, так как без данных сессии клиент не сможет работать
      throw error;
    }
  }


  /**
   * Удаляет сессию пользователя
   */
  async deleteSession(userId: string): Promise<void> {
    try {
      // Отключаем клиент
      const client = this.clients.get(userId);
      if (client) {
        await client.disconnect();
        this.clients.delete(userId);
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
   * Получает список всех активных сессий пользователя
   * Для админа возвращает все сессии в системе
   */
  async getUserSessions(userId: string): Promise<TelegramUserSession[]> {
    // Проверяем, является ли пользователь админом
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    // Если админ - возвращаем все сессии в системе
    if (user?.role === UserRole.ADMIN) {
      return await this.sessionRepository.find({
        where: { isActive: true },
        order: { lastUsedAt: 'DESC' },
        relations: ['user'], // Загружаем информацию о пользователе
      });
    }

    // Для обычных пользователей - только их сессии
    return await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastUsedAt: 'DESC' },
    });
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

    // Если это текущая активная сессия, отключаем клиент
    if (session.isActive) {
      const sessionOwnerId = session.userId;
      const client = this.clients.get(sessionOwnerId);
      if (client) {
        await client.disconnect();
        this.clients.delete(sessionOwnerId);
      }
    }

    // Деактивируем сессию в БД
    session.isActive = false;
    await this.sessionRepository.save(session);

    this.logger.log(`Session ${sessionId} deactivated by user ${userId} (session owner: ${session.userId})`);
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
    for (const [userId, client] of this.clients.entries()) {
      try {
        await client.disconnect();
        this.logger.log(`Client disconnected for user ${userId}`);
      } catch (error: any) {
        this.logger.error(`Error disconnecting client for user ${userId}: ${error.message}`);
      }
    }
    this.clients.clear();
  }
}

