import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private usersService: UsersService,
  ) {}

  async processPayment(
    userId: string,
    appointmentId: string,
    amount: number,
    bonusPointsUsed: number = 0,
  ): Promise<Transaction> {
    return await this.transactionRepository.manager.transaction(async (manager) => {
      if (bonusPointsUsed > 0) {
        const userRepo = manager.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
          throw new BadRequestException('User not found');
        }
        if (user.bonusPoints < bonusPointsUsed) {
          throw new BadRequestException('Insufficient bonus points');
        }
        user.bonusPoints = Math.max(0, user.bonusPoints - bonusPointsUsed);
        await userRepo.save(user);
      }

      const transaction = this.transactionRepository.create({
        userId,
        appointmentId,
        type: TransactionType.PAYMENT,
        amount: -amount,
        description: `Payment for appointment ${appointmentId}`,
        metadata: { bonusPointsUsed },
      });

      return await manager.getRepository(Transaction).save(transaction);
    });
  }

  async calculateBonusPoints(service: Service, finalPrice: number): Promise<number> {
    if (service.bonusPointsPercent === 0) {
      return 0;
    }
    return Math.floor((finalPrice * service.bonusPointsPercent) / 100);
  }

  async awardBonusPoints(
    userId: string,
    appointmentId: string | null,
    points: number,
    description?: string,
  ): Promise<Transaction> {
    await this.usersService.updateBonusPoints(userId, points);

    const transactionDescription = description || 
      (appointmentId ? `Bonus points earned for appointment ${appointmentId}` : 'Bonus points earned');

    const transaction = this.transactionRepository.create({
      userId,
      appointmentId: appointmentId ?? undefined,
      type: TransactionType.BONUS_EARNED,
      amount: points,
      description: transactionDescription,
    });

    return await this.transactionRepository.save(transaction);
  }

  async refundBonusPoints(
    userId: string,
    points: number,
    appointmentId: string,
  ): Promise<Transaction> {
    await this.usersService.updateBonusPoints(userId, points);

    const transaction = this.transactionRepository.create({
      userId,
      appointmentId,
      type: TransactionType.REFUND,
      amount: points,
      description: `Bonus points refunded for cancelled appointment ${appointmentId}`,
    });

    return await this.transactionRepository.save(transaction);
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      where: { userId },
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });
  }
}

