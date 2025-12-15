import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TelegramUserClientService } from './telegram-user-client.service';
import { SessionEncryptionService } from './session-encryption.service';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { User } from '../../../entities/user.entity';

describe('TelegramUserClientService', () => {
  let service: TelegramUserClientService;
  let sessionRepository: Repository<TelegramUserSession>;
  let userRepository: Repository<User>;
  let encryptionService: SessionEncryptionService;
  let configService: ConfigService;

  const mockSessionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUserClientService,
        {
          provide: getRepositoryToken(TelegramUserSession),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: SessionEncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TelegramUserClientService>(TelegramUserClientService);
    sessionRepository = module.get<Repository<TelegramUserSession>>(
      getRepositoryToken(TelegramUserSession),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    encryptionService = module.get<SessionEncryptionService>(SessionEncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSessions', () => {
    it('должен вернуть список активных сессий пользователя', async () => {
      const userId = 'user-123';
      const mockSessions: TelegramUserSession[] = [
        {
          id: 'session-1',
          userId,
          phoneNumber: '+79001234567',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          isActive: true,
          lastUsedAt: new Date('2025-12-15'),
          createdAt: new Date('2025-12-14'),
        } as TelegramUserSession,
        {
          id: 'session-2',
          userId,
          phoneNumber: '+79001234567',
          ipAddress: '192.168.1.2',
          userAgent: 'Chrome',
          isActive: true,
          lastUsedAt: new Date('2025-12-14'),
          createdAt: new Date('2025-12-13'),
        } as TelegramUserSession,
      ];

      mockSessionRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions(userId);

      expect(result).toEqual(mockSessions);
      expect(mockSessionRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('должен вернуть пустой массив, если нет активных сессий', async () => {
      const userId = 'user-123';
      mockSessionRepository.find.mockResolvedValue([]);

      const result = await service.getUserSessions(userId);

      expect(result).toEqual([]);
      expect(mockSessionRepository.find).toHaveBeenCalled();
    });
  });

  describe('deactivateSession', () => {
    it('должен деактивировать сессию и отключить клиент', async () => {
      const userId = 'user-123';
      const sessionId = 'session-1';
      const mockSession: TelegramUserSession = {
        id: sessionId,
        userId,
        isActive: true,
      } as TelegramUserSession;

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue({ ...mockSession, isActive: false });

      // Мокаем clients Map
      const mockClient = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      };
      (service as any).clients = new Map([[userId, mockClient]]);

      await service.deactivateSession(userId, sessionId);

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
      });
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockSession.isActive).toBe(false);
      expect(mockSessionRepository.save).toHaveBeenCalledWith(mockSession);
    });

    it('должен выбросить ошибку, если сессия не найдена', async () => {
      const userId = 'user-123';
      const sessionId = 'session-1';

      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivateSession(userId, sessionId)).rejects.toThrow('Session not found');
      expect(mockSessionRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('deactivateOtherSessions', () => {
    it('должен деактивировать все сессии кроме указанной', async () => {
      const userId = 'user-123';
      const keepSessionId = 'session-1';
      const mockSessions: TelegramUserSession[] = [
        {
          id: 'session-1',
          userId,
          isActive: true,
        } as TelegramUserSession,
        {
          id: 'session-2',
          userId,
          isActive: true,
        } as TelegramUserSession,
        {
          id: 'session-3',
          userId,
          isActive: true,
        } as TelegramUserSession,
      ];

      mockSessionRepository.find.mockResolvedValue(mockSessions);
      mockSessionRepository.save.mockResolvedValue({});

      await service.deactivateOtherSessions(userId, keepSessionId);

      expect(mockSessionRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
      });
      // Должны быть сохранены session-2 и session-3, но не session-1
      expect(mockSessionRepository.save).toHaveBeenCalledTimes(2);
    });

    it('должен деактивировать все сессии, если keepSessionId не указан', async () => {
      const userId = 'user-123';
      const mockSessions: TelegramUserSession[] = [
        {
          id: 'session-1',
          userId,
          isActive: true,
        } as TelegramUserSession,
        {
          id: 'session-2',
          userId,
          isActive: true,
        } as TelegramUserSession,
      ];

      mockSessionRepository.find.mockResolvedValue(mockSessions);
      mockSessionRepository.save.mockResolvedValue({});

      await service.deactivateOtherSessions(userId);

      expect(mockSessionRepository.find).toHaveBeenCalled();
      // Все сессии должны быть деактивированы
      expect(mockSessionRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});

