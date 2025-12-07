import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification, NotificationChannel } from '../../entities/notification.entity';
import { AuditAction } from '../../entities/audit-log.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;
  let auditService: AuditService;

  const mockNotificationsService = {
    sendBroadcast: jest.fn(),
    getBroadcastHistory: jest.fn(),
    getBroadcastDetails: jest.fn(),
    getBroadcastDetailsByKey: jest.fn(),
    deleteNotifications: jest.fn(),
    deleteNotification: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockNotificationRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('должен вернуть уведомления пользователя', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockNotifications: Notification[] = [
        { id: 'notification-1', userId: 'user-1' } as Notification,
      ];

      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await controller.getUserNotifications(req);

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });

  describe('sendBroadcast', () => {
    it('должен отправить рассылку', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const dto = {
        title: 'Test Title',
        message: 'Test Message',
        channel: NotificationChannel.TELEGRAM,
      };
      const mockResult = {
        total: 10,
        sent: 8,
        failed: 2,
      };

      mockNotificationsService.sendBroadcast.mockResolvedValue(mockResult);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.sendBroadcast(req, dto);

      expect(result).toEqual(mockResult);
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('getBroadcastHistory', () => {
    it('должен вернуть историю рассылок', async () => {
      const mockHistory = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      };

      mockNotificationsService.getBroadcastHistory.mockResolvedValue(mockHistory);

      const result = await controller.getBroadcastHistory();

      expect(result).toEqual(mockHistory);
    });
  });

  describe('deleteNotifications', () => {
    it('должен удалить уведомления', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { ids: ['notification-1', 'notification-2'] };

      mockNotificationsService.deleteNotifications.mockResolvedValue(2);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.deleteNotifications(body, req);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
    });
  });
});

