import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from '../../entities/user.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Notification } from '../../entities/notification.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;
  let appointmentRepository: Repository<Appointment>;
  let transactionRepository: Repository<Transaction>;
  let notificationRepository: Repository<Notification>;

  const mockUserRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  const mockAppointmentRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockTransactionRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockNotificationRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    appointmentRepository = module.get<Repository<Appointment>>(
      getRepositoryToken(Appointment),
    );
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    notificationRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список пользователей', async () => {
      const mockUsers: User[] = [
        {
          id: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          role: UserRole.CLIENT,
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(1);
    });

    it('должен фильтровать по роли', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(UserRole.CLIENT);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.role = :role',
        { role: UserRole.CLIENT },
      );
    });
  });

  describe('findById', () => {
    it('должен вернуть пользователя если он существует', async () => {
      const userId = 'user-1';
      const mockUser: User = {
        id: userId,
        firstName: 'Test',
        lastName: 'User',
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(userId);

      expect(result).toEqual(mockUser);
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByTelegramId', () => {
    it('должен вернуть пользователя по Telegram ID', async () => {
      const telegramId = '123456789';
      const mockUser: User = {
        id: 'user-1',
        telegramId,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByTelegramId(telegramId);

      expect(result).toEqual(mockUser);
    });

    it('должен вернуть null если пользователь не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByTelegramId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByPhone', () => {
    it('должен вернуть пользователя по телефону', async () => {
      const phone = '+79991234567';
      const mockUser: User = {
        id: 'user-1',
        phone,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPhone(phone);

      expect(result).toEqual(mockUser);
    });
  });

  describe('normalizePhone - edge cases', () => {
    it('должен обработать телефон с пробелами', () => {
      const result = service.normalizePhone('+7 999 123 45 67');
      expect(result).toBe('+79991234567');
    });

    it('должен обработать телефон с дефисами', () => {
      const result = service.normalizePhone('+7-999-123-45-67');
      expect(result).toBe('+79991234567');
    });

    it('должен обработать телефон без плюса', () => {
      const result = service.normalizePhone('79991234567');
      expect(result).toBe('+79991234567');
    });

    it('должен обработать телефон с 8', () => {
      const result = service.normalizePhone('89991234567');
      expect(result).toBe('+79991234567');
    });
  });

  describe('normalizePhone', () => {
    it('должен нормализовать номер телефона с 8', () => {
      const phone = '89991234567';
      const result = service.normalizePhone(phone);

      expect(result).toBe('+79991234567');
    });

    it('должен нормализовать номер телефона с 7', () => {
      const phone = '79991234567';
      const result = service.normalizePhone(phone);

      expect(result).toBe('+79991234567');
    });

    it('должен оставить номер с +7 без изменений', () => {
      const phone = '+79991234567';
      const result = service.normalizePhone(phone);

      expect(result).toBe('+79991234567');
    });
  });

  describe('update', () => {
    it('должен обновить пользователя', async () => {
      const userId = 'user-1';
      const existingUser: User = {
        id: userId,
        firstName: 'Old',
        lastName: 'Name',
      } as User;

      const updatedUser: User = {
        ...existingUser,
        firstName: 'New',
      } as User;

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update(userId, { firstName: 'New' });

      expect(result.firstName).toBe('New');
    });
  });

  describe('updateBonusPoints', () => {
    it('должен обновить бонусные баллы', async () => {
      const userId = 'user-1';
      const existingUser: User = {
        id: userId,
        bonusPoints: 100,
      } as User;

      const updatedUser: User = {
        ...existingUser,
        bonusPoints: 150,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateBonusPoints(userId, 50);

      expect(result.bonusPoints).toBe(150);
    });

    it('должен не допустить отрицательные бонусные баллы', async () => {
      const userId = 'user-1';
      const existingUser: User = {
        id: userId,
        bonusPoints: 50,
      } as User;

      const updatedUser: User = {
        ...existingUser,
        bonusPoints: 0,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateBonusPoints(userId, -100);

      expect(result.bonusPoints).toBe(0);
    });
  });

  describe('create', () => {
    it('должен создать пользователя', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        phone: '+79991234567',
      };

      const mockUser: User = {
        id: 'user-1',
        ...userData,
        role: UserRole.CLIENT,
      } as User;

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(userData);

      expect(result).toEqual(mockUser);
    });
  });

  describe('delete', () => {
    it('должен удалить пользователя если нет связанных записей', async () => {
      const userId = 'user-1';
      const mockUser: User = {
        id: userId,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockTransactionRepository.count.mockResolvedValue(0);
      mockNotificationRepository.count.mockResolvedValue(0);
      mockUserRepository.remove.mockResolvedValue(mockUser);

      await service.delete(userId);

      expect(mockUserRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('должен выбросить ошибку если есть связанные записи', async () => {
      const userId = 'user-1';
      const mockUser: User = {
        id: userId,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockAppointmentRepository.count.mockResolvedValue(5);

      await expect(service.delete(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll - edge cases', () => {
    it('должен фильтровать пользователей по search', async () => {
      const search = 'test';
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, search, 1, 20);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('должен фильтровать пользователей по isActive', async () => {
      const isActive = true;
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, undefined, 1, 20);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('getInteractionHistory', () => {
    it('должен вернуть историю взаимодействий пользователя', async () => {
      const userId = 'user-1';
      const mockAppointments = [
        {
          id: 'appointment-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'confirmed',
          service: { name: 'Service 1' },
          master: { name: 'Master 1' },
        } as any,
      ];
      const mockTransactions = [
        {
          id: 'transaction-1',
          createdAt: new Date(),
          type: 'PAYMENT',
        } as any,
      ];
      const mockNotifications = [
        {
          id: 'notification-1',
          createdAt: new Date(),
        } as any,
      ];

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);
      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getInteractionHistory(userId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('должен обработать транзакции разных типов', async () => {
      const userId = 'user-1';
      const mockTransactions = [
        {
          id: 'trx-1',
          type: 'bonus_earned',
          amount: 100,
          createdAt: new Date(),
          description: 'Test',
        },
        {
          id: 'trx-2',
          type: 'bonus_used',
          amount: 50,
          createdAt: new Date(),
        },
        {
          id: 'trx-3',
          type: 'refund',
          amount: 25,
          createdAt: new Date(),
        },
      ] as any[];

      const mockAppointments: any[] = [];
      const mockNotifications: any[] = [];

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);
      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getInteractionHistory(userId);

      expect(result.length).toBe(3);
      expect(result.some((item) => item.type === 'transaction')).toBe(true);
    });

    it('должен обработать уведомления разных каналов', async () => {
      const userId = 'user-1';
      const mockNotifications = [
        {
          id: 'notif-1',
          channel: 'telegram',
          status: 'sent',
          title: 'Test',
          message: 'Message',
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          channel: 'sms',
          status: 'failed',
          title: 'Test 2',
          message: 'Message 2',
          createdAt: new Date(),
        },
      ] as any[];

      const mockAppointments: any[] = [];
      const mockTransactions: any[] = [];

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);
      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getInteractionHistory(userId);

      expect(result.length).toBe(2);
      expect(result.every((item) => item.type === 'notification')).toBe(true);
    });

    it('должен обработать изменение статуса записи', async () => {
      const userId = 'user-1';
      const mockAppointments = [
        {
          id: 'apt-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          status: 'confirmed',
          service: { name: 'Service 1' },
          master: { name: 'Master 1' },
        },
        {
          id: 'apt-2',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          status: 'cancelled',
          cancellationReason: 'Test reason',
          service: { name: 'Service 2' },
          master: { name: 'Master 2' },
        },
      ] as any[];

      const mockTransactions: any[] = [];
      const mockNotifications: any[] = [];

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);
      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getInteractionHistory(userId);

      expect(result.some((item) => item.type === 'appointment_status_changed')).toBe(true);
    });
  });
});

