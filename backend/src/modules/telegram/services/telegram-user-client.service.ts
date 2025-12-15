import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, Storage, StorageKeyPart } from '@mtkruto/node';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { SessionEncryptionService } from './session-encryption.service';
import { User } from '../../../entities/user.entity';

/**
 * Кастомный Storage адаптер для MTKruto, который сохраняет сессии в БД с шифрованием
 */
class DatabaseStorage implements Partial<Storage> {
  constructor(
    private sessionRepository: Repository<TelegramUserSession>,
    private encryptionService: SessionEncryptionService,
    private userId: string,
    private apiId: number,
    private apiHash: string,
  ) {}

  async get(key: readonly StorageKeyPart[]): Promise<Uint8Array | null> {
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
        return new TextEncoder().encode(current);
      }

      return current instanceof Uint8Array ? current : null;
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

      if (session) {
        const decrypted = this.encryptionService.decrypt(session.encryptedSessionData);
        data = JSON.parse(decrypted);
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
        await this.sessionRepository.save(session);
      } else {
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
   */
  async getClient(userId: string): Promise<Client | null> {
    try {
      // Проверяем, есть ли уже активный клиент
      if (this.clients.has(userId)) {
        const client = this.clients.get(userId)!;
        if (client.connected) {
          return client;
        }
        // Если клиент отключен, удаляем его
        this.clients.delete(userId);
      }

      // Получаем сессию из БД
      const session = await this.sessionRepository.findOne({
        where: {
          userId,
          isActive: true,
        },
      });

      if (!session) {
        this.logger.warn(`No active session found for user ${userId}`);
        return null;
      }

      // Получаем API credentials
      const apiId = this.configService.get<number>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      // Создаем Storage адаптер
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        userId,
        apiId,
        apiHash,
      );

      // Создаем клиент
      const client = new Client({
        apiId,
        apiHash,
        storage,
      });

      // Сохраняем клиент
      this.clients.set(userId, client);

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
   */
  async createClientForAuth(apiId: number, apiHash: string): Promise<Client> {
    const client = new Client({
      apiId,
      apiHash,
    });

    await client.connect();
    return client;
  }

  /**
   * Сохраняет сессию после успешной авторизации
   */
  async saveSession(
    userId: string,
    client: Client,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Получаем данные сессии из клиента
      // MTKruto хранит сессию в storage, нам нужно получить её
      const apiId = this.configService.get<number>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set');
      }

      // Создаем Storage адаптер для сохранения
      const storage = new DatabaseStorage(
        this.sessionRepository,
        this.encryptionService,
        userId,
        apiId,
        apiHash,
      );

      // Копируем данные сессии из клиента в наш storage
      // Это делается через переключение storage клиента
      // Но так как мы не можем напрямую получить данные из storage клиента,
      // мы создадим новую сессию с нашим storage и переподключимся
      const newClient = new Client({
        apiId,
        apiHash,
        storage,
      });

      // Сохраняем сессию в БД
      const sessionData = await this.extractSessionData(client);
      const encrypted = this.encryptionService.encrypt(JSON.stringify(sessionData));

      let session = await this.sessionRepository.findOne({
        where: { userId, apiId },
      });

      if (session) {
        session.encryptedSessionData = encrypted;
        session.phoneNumber = phoneNumber;
        session.isActive = true;
        session.lastUsedAt = new Date();
        session.ipAddress = ipAddress || null;
        session.userAgent = userAgent || null;
      } else {
        session = this.sessionRepository.create({
          userId,
          apiId,
          apiHash,
          encryptedSessionData: encrypted,
          phoneNumber,
          isActive: true,
          lastUsedAt: new Date(),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        });
      }

      await this.sessionRepository.save(session);

      // Обновляем клиент в кэше
      this.clients.set(userId, newClient);
      await newClient.connect();

      this.logger.log(`Session saved for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Error saving session for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Извлекает данные сессии из клиента (временное решение)
   * В будущем можно улучшить, если MTKruto предоставит API для этого
   */
  private async extractSessionData(client: Client): Promise<any> {
    // Это временная реализация
    // В реальности нужно получить данные из storage клиента
    // Пока возвращаем пустой объект, данные будут сохранены через наш DatabaseStorage
    return {};
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

