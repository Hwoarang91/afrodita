import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TelegramUserController } from './telegram-user.controller';
import { TelegramUserClientService } from '../services/telegram-user-client.service';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';

describe('TelegramUserController', () => {
  let controller: TelegramUserController;
  let telegramUserClientService: TelegramUserClientService;

  const mockTelegramUserClientService = {
    getClient: jest.fn(),
    getUserSessions: jest.fn(),
    deactivateSession: jest.fn(),
    deactivateOtherSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramUserController],
      providers: [
        {
          provide: TelegramUserClientService,
          useValue: mockTelegramUserClientService,
        },
      ],
    }).compile();

    controller = module.get<TelegramUserController>(TelegramUserController);
    telegramUserClientService = module.get<TelegramUserClientService>(TelegramUserClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessions', () => {
    it('должен вернуть список сессий пользователя', async () => {
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
      ];

      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.getUserSessions.mockResolvedValue(mockSessions);

      const result = await controller.getSessions(req as any);

      expect(result).toEqual({
        success: true,
        sessions: [
          {
            id: 'session-1',
            phoneNumber: '+79001234567',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            isActive: true,
            lastUsedAt: new Date('2025-12-15'),
            createdAt: new Date('2025-12-14'),
          },
        ],
      });
      expect(mockTelegramUserClientService.getUserSessions).toHaveBeenCalledWith(userId);
    });

    it('должен выбросить UnauthorizedException при ошибке', async () => {
      const userId = 'user-123';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.getUserSessions.mockRejectedValue(new Error('Database error'));

      await expect(controller.getSessions(req as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('deactivateSession', () => {
    it('должен деактивировать сессию', async () => {
      const userId = 'user-123';
      const sessionId = 'session-1';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.deactivateSession.mockResolvedValue(undefined);

      const result = await controller.deactivateSession(sessionId, req as any);

      expect(result).toEqual({ success: true });
      expect(mockTelegramUserClientService.deactivateSession).toHaveBeenCalledWith(userId, sessionId);
    });

    it('должен выбросить UnauthorizedException при ошибке', async () => {
      const userId = 'user-123';
      const sessionId = 'session-1';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.deactivateSession.mockRejectedValue(new Error('Session not found'));

      await expect(controller.deactivateSession(sessionId, req as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('deactivateOtherSessions', () => {
    it('должен деактивировать все другие сессии', async () => {
      const userId = 'user-123';
      const keepSessionId = 'session-1';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.deactivateOtherSessions.mockResolvedValue(undefined);

      const result = await controller.deactivateOtherSessions(req as any, keepSessionId);

      expect(result).toEqual({ success: true });
      expect(mockTelegramUserClientService.deactivateOtherSessions).toHaveBeenCalledWith(userId, keepSessionId);
    });

    it('должен деактивировать все другие сессии без keepSessionId', async () => {
      const userId = 'user-123';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.deactivateOtherSessions.mockResolvedValue(undefined);

      const result = await controller.deactivateOtherSessions(req as any);

      expect(result).toEqual({ success: true });
      expect(mockTelegramUserClientService.deactivateOtherSessions).toHaveBeenCalledWith(userId, undefined);
    });

    it('должен выбросить UnauthorizedException при ошибке', async () => {
      const userId = 'user-123';
      const req = {
        user: { sub: userId },
      };

      mockTelegramUserClientService.deactivateOtherSessions.mockRejectedValue(new Error('Database error'));

      await expect(controller.deactivateOtherSessions(req as any)).rejects.toThrow(UnauthorizedException);
    });
  });
});

