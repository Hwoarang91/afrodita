import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { Appointment } from '../../entities/appointment.entity';
import { UsersService } from '../users/users.service';

describe('FinancialService', () => {
  let service: FinancialService;
  let transactionRepository: Repository<Transaction>;
  let usersService: UsersService;

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
    updateBonusPoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<FinancialService>(FinancialService);
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment - edge cases', () => {
    it('должен выбросить ошибку если недостаточно бонусных баллов', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const amount = 1000;
      const bonusPointsUsed = 1000;

      const mockUser = {
        id: userId,
        bonusPoints: 500,
      } as any;

      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(
        service.processPayment(userId, appointmentId, amount, bonusPointsUsed),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен обработать платеж без использования бонусов', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const amount = 1000;

      const mockTransaction = {
        id: 'transaction-1',
        userId,
        appointmentId,
        type: TransactionType.PAYMENT,
        amount: -amount,
      } as Transaction;

      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.processPayment(userId, appointmentId, amount, 0);

      expect(result).toEqual(mockTransaction);
      expect(mockUsersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('processPayment', () => {
    it('должен обработать платеж без использования бонусных баллов', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const amount = 1000;

      const mockTransaction: Transaction = {
        id: 'transaction-1',
        userId,
        appointmentId,
        type: TransactionType.PAYMENT,
        amount: -amount,
        description: `Payment for appointment ${appointmentId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as User,
        appointment: {} as Appointment,
      } as Transaction;

      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.processPayment(userId, appointmentId, amount);

      expect(result).toEqual(mockTransaction);
      expect(mockUsersService.updateBonusPoints).not.toHaveBeenCalled();
    });

    it('должен обработать платеж с использованием бонусных баллов', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const amount = 1000;
      const bonusPointsUsed = 100;

      const mockUser: User = {
        id: userId,
        bonusPoints: 200,
      } as User;

      const mockTransaction: Transaction = {
        id: 'transaction-1',
        userId,
        appointmentId,
        type: TransactionType.PAYMENT,
        amount: -amount,
        description: `Payment for appointment ${appointmentId}`,
        metadata: { bonusPointsUsed },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as User,
        appointment: {} as Appointment,
      } as Transaction;

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockUsersService.updateBonusPoints.mockResolvedValue(undefined);
      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.processPayment(
        userId,
        appointmentId,
        amount,
        bonusPointsUsed,
      );

      expect(result).toEqual(mockTransaction);
      expect(mockUsersService.updateBonusPoints).toHaveBeenCalledWith(
        userId,
        -bonusPointsUsed,
      );
    });

    it('должен выбросить ошибку если недостаточно бонусных баллов', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const amount = 1000;
      const bonusPointsUsed = 300;

      const mockUser: User = {
        id: userId,
        bonusPoints: 100,
      } as User;

      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(
        service.processPayment(userId, appointmentId, amount, bonusPointsUsed),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('calculateBonusPoints - edge cases', () => {
    it('должен вернуть 0 если bonusPointsPercent равен 0', async () => {
      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 0,
      } as Service;

      const result = await service.calculateBonusPoints(mockService, 1000);

      expect(result).toBe(0);
    });

    it('должен вернуть 0 если finalPrice равен 0', async () => {
      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 10,
      } as Service;

      const result = await service.calculateBonusPoints(mockService, 0);

      expect(result).toBe(0);
    });

    it('должен округлить результат вниз', async () => {
      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 3,
      } as Service;

      const result = await service.calculateBonusPoints(mockService, 100);

      expect(result).toBe(3);
    });
  });

  describe('calculateBonusPoints', () => {
    it('должен рассчитать бонусные баллы', async () => {
      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 10,
      } as Service;

      const finalPrice = 1000;
      const result = await service.calculateBonusPoints(mockService, finalPrice);

      expect(result).toBe(100);
    });

    it('должен вернуть 0 если процент бонусных баллов равен 0', async () => {
      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 0,
      } as Service;

      const finalPrice = 1000;
      const result = await service.calculateBonusPoints(mockService, finalPrice);

      expect(result).toBe(0);
    });
  });

  describe('awardBonusPoints', () => {
    it('должен начислить бонусные баллы', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const points = 100;

      const mockTransaction: Transaction = {
        id: 'transaction-1',
        userId,
        appointmentId,
        type: TransactionType.BONUS_EARNED,
        amount: points,
        description: `Bonus points earned for appointment ${appointmentId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as User,
        appointment: {} as Appointment,
      } as Transaction;

      mockUsersService.updateBonusPoints.mockResolvedValue(undefined);
      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.awardBonusPoints(userId, appointmentId, points);

      expect(result).toEqual(mockTransaction);
      expect(mockUsersService.updateBonusPoints).toHaveBeenCalledWith(userId, points);
    });
  });

  describe('refundBonusPoints', () => {
    it('должен вернуть бонусные баллы', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const points = 100;

      const mockTransaction: Transaction = {
        id: 'transaction-1',
        userId,
        appointmentId,
        type: TransactionType.REFUND,
        amount: points,
        description: `Bonus points refunded for cancelled appointment ${appointmentId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {} as User,
        appointment: {} as Appointment,
      } as Transaction;

      mockUsersService.updateBonusPoints.mockResolvedValue(undefined);
      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.refundBonusPoints(userId, points, appointmentId);

      expect(result).toEqual(mockTransaction);
      expect(mockUsersService.updateBonusPoints).toHaveBeenCalledWith(userId, points);
    });
  });

  describe('getUserTransactions', () => {
    it('должен вернуть транзакции пользователя', async () => {
      const userId = 'user-1';
      const mockTransactions: Transaction[] = [
        {
          id: 'transaction-1',
          userId,
          type: TransactionType.PAYMENT,
          amount: -1000,
          user: {} as User,
          appointment: {} as Appointment,
        } as Transaction,
      ];

      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.getUserTransactions(userId);

      expect(result).toEqual(mockTransactions);
      expect(mockTransactionRepository.find).toHaveBeenCalledWith({
        where: { userId },
        relations: ['appointment'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});

