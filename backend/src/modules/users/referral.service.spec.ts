import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { SettingsService } from '../settings/settings.service';
import { FinancialService } from '../financial/financial.service';

describe('ReferralService', () => {
  let service: ReferralService;
  let userRepository: jest.Mocked<Repository<User>>;
  let settingsService: jest.Mocked<SettingsService>;
  let financialService: jest.Mocked<FinancialService>;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockTransactionRepository = {};

  const mockSettingsService = {
    getBonusSettings: jest.fn(),
  };

  const mockFinancialService = {
    awardBonusPoints: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepository },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: FinancialService, useValue: mockFinancialService },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
    userRepository = module.get(getRepositoryToken(User));
    settingsService = module.get(SettingsService);
    financialService = module.get(FinancialService);
  });

  describe('generateReferralCode', () => {
    it('должен сгенерировать и сохранить уникальный код', async () => {
      const userId = 'user-1';
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // по коду — свободен
        .mockResolvedValueOnce({ id: userId, referralCode: null } as User); // по userId

      mockUserRepository.save.mockResolvedValue({} as User);

      const code = await service.generateReferralCode(userId);

      expect(typeof code).toBe('string');
      expect(code.length).toBe(8);
      expect(/^[A-F0-9]+$/.test(code)).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ referralCode: code }),
      );
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.generateReferralCode('missing')).rejects.toThrow(NotFoundException);
      await expect(service.generateReferralCode('missing')).rejects.toThrow('Пользователь не найден');
    });

    it('должен перегенерировать код при коллизии', async () => {
      const userId = 'user-1';
      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: 'other' } as User) // первый код занят
        .mockResolvedValueOnce(null) // второй свободен
        .mockResolvedValueOnce({ id: userId } as User);

      mockUserRepository.save.mockResolvedValue({} as User);

      const code = await service.generateReferralCode(userId);
      expect(typeof code).toBe('string');
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('getOrGenerateReferralCode', () => {
    it('должен вернуть существующий код', async () => {
      const userId = 'user-1';
      const existingCode = 'ABCD1234';
      mockUserRepository.findOne.mockResolvedValue({ id: userId, referralCode: existingCode } as User);

      const code = await service.getOrGenerateReferralCode(userId);
      expect(code).toBe(existingCode);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('должен сгенерировать код если его нет', async () => {
      const userId = 'user-1';
      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: userId, referralCode: null } as User)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: userId } as User);
      mockUserRepository.save.mockResolvedValue({} as User);

      const code = await service.getOrGenerateReferralCode(userId);
      expect(typeof code).toBe('string');
      expect(code.length).toBe(8);
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.getOrGenerateReferralCode('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserByReferralCode', () => {
    it('должен вернуть пользователя по коду (верхний регистр)', async () => {
      const ref = { id: 'ref-1', referralCode: 'ABCD1234' } as User;
      mockUserRepository.findOne.mockResolvedValue(ref);

      const user = await service.getUserByReferralCode('abcd1234');
      expect(user).toEqual(ref);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { referralCode: 'ABCD1234' },
      });
    });

    it('должен вернуть null если код не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const user = await service.getUserByReferralCode('NOSUCH');
      expect(user).toBeNull();
    });
  });

  describe('processReferralRegistration', () => {
    it('должен вернуть { registrationBonus: 0 } если бонусы отключены', async () => {
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: false,
        pointsForRegistration: 100,
        pointsForReferral: 50,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne.mockResolvedValue({ id: 'new-1' } as User);

      const result = await service.processReferralRegistration('new-1', 'CODE');
      expect(result).toEqual({ registrationBonus: 0 });
      expect(mockFinancialService.awardBonusPoints).not.toHaveBeenCalled();
    });

    it('должен начислить только бонус за регистрацию без реферального кода', async () => {
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: true,
        pointsForRegistration: 100,
        pointsForReferral: 50,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: 'new-1', firstName: 'A', lastName: 'B' } as User)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-1' } as User);
      mockUserRepository.save.mockResolvedValue({} as User);
      mockFinancialService.awardBonusPoints.mockResolvedValue({} as any);

      const result = await service.processReferralRegistration('new-1');

      expect(result).toEqual({ registrationBonus: 100 });
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledWith('new-1', null, 100);
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledTimes(1);
    });

    it('должен выбросить NotFoundException если новый пользователь не найден', async () => {
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: true,
        pointsForRegistration: 10,
        pointsForReferral: 5,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.processReferralRegistration('missing')).rejects.toThrow(NotFoundException);
    });

    it('должен начислить бонусы новому, пригласившему и привязать referredBy при валидном коде', async () => {
      const referrer = { id: 'ref-1', referralCode: 'REFCODE' } as User;
      const newUser = { id: 'new-1', firstName: 'New', lastName: 'User', referredByUserId: null } as User;
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: true,
        pointsForRegistration: 100,
        pointsForReferral: 50,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne
        .mockResolvedValueOnce(newUser)
        .mockResolvedValueOnce(referrer)
        .mockResolvedValueOnce(null)  // generateReferralCode: по коду
        .mockResolvedValueOnce({ id: 'new-1' } as User); // generateReferralCode: по userId
      mockUserRepository.save
        .mockResolvedValueOnce({} as User) // referredByUserId
        .mockResolvedValueOnce({} as User); // referralCode в generate
      mockFinancialService.awardBonusPoints.mockResolvedValue({} as any);

      const result = await service.processReferralRegistration('new-1', 'REFCODE');

      expect(result.registrationBonus).toBe(100);
      expect(result.referralBonus).toBe(50);
      expect(result.referrerBonus).toBe(50);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ referredByUserId: 'ref-1' }),
      );
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledWith('new-1', null, 100);
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledWith('new-1', null, 50);
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledWith(
        'ref-1',
        null,
        50,
        expect.stringContaining('Бонусы за приглашение'),
      );
    });

    it('не должен начислять реферальные бонусы если пользователь использует свой код', async () => {
      const user = { id: 'u1', referralCode: 'MYCODE', firstName: 'A', lastName: 'B' } as User;
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: true,
        pointsForRegistration: 50,
        pointsForReferral: 25,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user) // getUserByReferralCode — тот же user
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u1' } as User);
      mockUserRepository.save.mockResolvedValue({} as User);
      mockFinancialService.awardBonusPoints.mockResolvedValue({} as any);

      const result = await service.processReferralRegistration('u1', 'MYCODE');

      expect(result.registrationBonus).toBe(50);
      expect(result.referralBonus).toBeUndefined();
      expect(result.referrerBonus).toBeUndefined();
      // referredByUserId не должен ставиться (referrer.id === newUserId)
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledTimes(1);
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledWith('u1', null, 50);
    });

    it('не должен начислять реферальные бонусы при несуществующем коде', async () => {
      mockSettingsService.getBonusSettings.mockResolvedValue({
        enabled: true,
        pointsForRegistration: 20,
        pointsForReferral: 10,
        pointsPerRuble: 0,
      });
      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: 'new-1' } as User)
        .mockResolvedValueOnce(null) // getUserByReferralCode — не найден
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-1' } as User);
      mockUserRepository.save.mockResolvedValue({} as User);
      mockFinancialService.awardBonusPoints.mockResolvedValue({} as any);

      const result = await service.processReferralRegistration('new-1', 'INVALID');

      expect(result.registrationBonus).toBe(20);
      expect(result.referralBonus).toBeUndefined();
      expect(result.referrerBonus).toBeUndefined();
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReferralStats', () => {
    it('должен вернуть статистику с рефералами', async () => {
      const user = { id: 'u1', referralCode: 'CODE1' } as User;
      const refs = [
        { id: 'r1', firstName: 'R1', lastName: 'L1', phone: '+1', createdAt: new Date('2024-01-01') },
        { id: 'r2', firstName: 'R2', lastName: null, phone: null, createdAt: new Date('2024-01-02') },
      ] as any;
      mockUserRepository.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user); // getOrGenerate — код есть
      mockUserRepository.find = jest.fn().mockResolvedValue(refs);

      const stats = await service.getReferralStats('u1');

      expect(stats.referralCode).toBe('CODE1');
      expect(stats.totalReferrals).toBe(2);
      expect(stats.referrals).toHaveLength(2);
      expect(stats.referrals[0]).toMatchObject({ id: 'r1', firstName: 'R1', lastName: 'L1' });
      expect(stats.referrals[1]).toMatchObject({ id: 'r2', firstName: 'R2', lastName: '' });
    });

    it('должен выбросить NotFoundException если пользователь не найден', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.getReferralStats('missing')).rejects.toThrow(NotFoundException);
    });

    it('должен сгенерировать код через getOrGenerate если у пользователя его нет', async () => {
      const user = { id: 'u1', referralCode: null } as User;
      mockUserRepository.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u1' } as User);
      mockUserRepository.save.mockResolvedValue({} as User);
      mockUserRepository.find = jest.fn().mockResolvedValue([]);

      const stats = await service.getReferralStats('u1');
      expect(typeof stats.referralCode).toBe('string');
      expect(stats.referralCode.length).toBe(8);
      expect(stats.totalReferrals).toBe(0);
      expect(stats.referrals).toEqual([]);
    });
  });
});
