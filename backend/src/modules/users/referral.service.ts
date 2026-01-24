import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { FinancialService } from '../financial/financial.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private settingsService: SettingsService,
    private financialService: FinancialService,
  ) {}

  /**
   * Генерирует уникальный реферальный код для пользователя
   */
  async generateReferralCode(userId: string): Promise<string> {
    let referralCode = '';
    let exists = true;

    // Генерируем код до тех пор, пока он не будет уникальным
    while (exists) {
      // Генерируем код из 8 символов (буквы и цифры)
      referralCode = randomBytes(4).toString('hex').toUpperCase();
      
      const existingUser = await this.userRepository.findOne({
        where: { referralCode },
      });
      
      exists = !!existingUser;
    }

    // Сохраняем код в профиле пользователя
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    user.referralCode = referralCode;
    await this.userRepository.save(user);

    this.logger.log(`Сгенерирован реферальный код ${referralCode} для пользователя ${userId}`);
    return referralCode;
  }

  /**
   * Получает реферальный код пользователя или генерирует новый
   */
  async getOrGenerateReferralCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    return await this.generateReferralCode(userId);
  }

  /**
   * Находит пользователя по реферальному коду
   */
  async getUserByReferralCode(referralCode: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { referralCode: referralCode.toUpperCase() },
    });
  }

  /**
   * Обрабатывает регистрацию нового пользователя по реферальному коду
   * Начисляет бонусы новому пользователю и пригласившему
   */
  async processReferralRegistration(
    newUserId: string,
    referralCode?: string,
  ): Promise<{ registrationBonus: number; referralBonus?: number; referrerBonus?: number }> {
    const bonusSettings = await this.settingsService.getBonusSettings();
    
    if (!bonusSettings.enabled) {
      this.logger.debug('Бонусная система отключена');
      return { registrationBonus: 0 };
    }

    const newUser = await this.userRepository.findOne({ where: { id: newUserId } });
    if (!newUser) {
      throw new NotFoundException('Пользователь не найден');
    }

    let registrationBonus = 0;
    let referralBonus = 0;
    let referrerBonus = 0;

    // 1. Начисляем бонус за регистрацию
    if (bonusSettings.pointsForRegistration > 0) {
      registrationBonus = bonusSettings.pointsForRegistration;
      await this.financialService.awardBonusPoints(
        newUserId,
        null, // appointmentId нет при регистрации
        registrationBonus,
      );
      this.logger.log(`Начислено ${registrationBonus} бонусов за регистрацию пользователю ${newUserId}`);
    }

    // 2. Обрабатываем реферальный код
    if (referralCode) {
      const referrer = await this.getUserByReferralCode(referralCode);
      
      if (referrer && referrer.id !== newUserId) {
        // Проверяем, что пользователь не приглашает сам себя
        newUser.referredByUserId = referrer.id;
        await this.userRepository.save(newUser);

        // Начисляем бонус новому пользователю за регистрацию по реферальному коду
        if (bonusSettings.pointsForReferral > 0) {
          referralBonus = bonusSettings.pointsForReferral;
          await this.financialService.awardBonusPoints(
            newUserId,
            null,
            referralBonus,
          );
          this.logger.log(`Начислено ${referralBonus} бонусов новому пользователю ${newUserId} за регистрацию по реферальному коду`);
        }

        // Начисляем бонус пригласившему пользователю
        // Используем тот же pointsForReferral для пригласившего
        if (bonusSettings.pointsForReferral > 0) {
          referrerBonus = bonusSettings.pointsForReferral;
          await this.financialService.awardBonusPoints(
            referrer.id,
            null,
            referrerBonus,
            `Бонусы за приглашение друга (реферал: ${newUser.firstName} ${newUser.lastName || ''})`,
          );
          this.logger.log(`Начислено ${referrerBonus} бонусов пользователю ${referrer.id} за приглашение друга`);
        }
      } else if (referrer && referrer.id === newUserId) {
        this.logger.warn(`Пользователь ${newUserId} попытался использовать свой собственный реферальный код`);
      } else {
        this.logger.warn(`Реферальный код ${referralCode} не найден`);
      }
    }

    // 3. Генерируем реферальный код для нового пользователя
    await this.generateReferralCode(newUserId);

    return {
      registrationBonus,
      referralBonus: referralBonus > 0 ? referralBonus : undefined,
      referrerBonus: referrerBonus > 0 ? referrerBonus : undefined,
    };
  }

  /**
   * Получает статистику по рефералам пользователя
   */
  async getReferralStats(userId: string): Promise<{
    referralCode: string;
    totalReferrals: number;
    referrals: Array<{ id: string; firstName: string; lastName: string; createdAt: Date }>;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const referralCode = await this.getOrGenerateReferralCode(userId);

    const referrals = await this.userRepository.find({
      where: { referredByUserId: userId },
      select: ['id', 'firstName', 'lastName', 'phone', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    return {
      referralCode,
      totalReferrals: referrals.length,
      referrals: referrals.map(r => ({
        id: r.id,
        firstName: r.firstName || '',
        lastName: r.lastName || '',
        phone: r.phone || null,
        createdAt: r.createdAt,
      })),
    };
  }
}
