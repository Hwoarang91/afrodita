import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionCleanupService } from './session-cleanup.service';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';

describe('SessionCleanupService', () => {
  let service: SessionCleanupService;
  const mockFind = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupService,
        {
          provide: getRepositoryToken(TelegramUserSession),
          useValue: {
            find: mockFind,
            update: mockUpdate,
            delete: mockDelete,
          },
        },
      ],
    }).compile();
    service = module.get<SessionCleanupService>(SessionCleanupService);
  });

  describe('cleanup', () => {
    it('помечает initializing > 24h как invalid', async () => {
      const initializing = [
        { id: 's1', status: 'initializing', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      ];
      mockFind
        .mockResolvedValueOnce(initializing)
        .mockResolvedValueOnce([]);
      mockUpdate.mockResolvedValue({ affected: 1 });

      await service.cleanup();

      expect(mockFind).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'invalid' }),
      );
    });

    it('удаляет invalid/revoked старше 30 дней', async () => {
      mockFind
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 's2' }]);
      mockDelete.mockResolvedValue({ affected: 1 });

      await service.cleanup();

      expect(mockFind).toHaveBeenCalledTimes(2);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('ничего не делает при пустых выборках', async () => {
      mockFind.mockResolvedValue([]);

      await service.cleanup();

      expect(mockFind).toHaveBeenCalledTimes(2);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
