import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus } from '../../entities/review.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';
import { normalizePagination } from '../../common/dto/pagination.dto';
import { FinancialService } from '../financial/financial.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
    private financialService: FinancialService,
    private settingsService: SettingsService,
  ) {}

  async create(
    userId: string,
    appointmentId: string,
    rating: number,
    comment?: string,
  ): Promise<Review> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Рейтинг должен быть от 1 до 5');
    }

    // Проверяем, что запись существует и принадлежит пользователю
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId, clientId: userId, status: AppointmentStatus.COMPLETED },
      relations: ['master', 'service'],
    });

    if (!appointment) {
      throw new NotFoundException('Запись не найдена или не завершена');
    }

    // Проверяем, не оставлен ли уже отзыв
    const existingReview = await this.reviewRepository.findOne({
      where: { appointmentId, userId },
    });

    if (existingReview) {
      throw new BadRequestException('Отзыв уже оставлен для этой записи');
    }

    const review = this.reviewRepository.create({
      userId,
      appointmentId,
      masterId: appointment.masterId,
      serviceId: appointment.serviceId,
      rating,
      comment,
      status: ReviewStatus.PENDING, // Требует модерации
    });

    const saved = await this.reviewRepository.save(review);

    // Обновляем рейтинг мастера
    await this.updateMasterRating(appointment.masterId);

    return saved;
  }

  async findAll(
    masterId?: string,
    serviceId?: string,
    status?: ReviewStatus,
    page?: number | string,
    limit?: number | string,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page: p, limit: l } = normalizePagination(page, limit);

    const query = this.reviewRepository.createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .leftJoinAndSelect('review.master', 'master')
      .leftJoinAndSelect('review.service', 'service');

    if (masterId) {
      query.andWhere('review.masterId = :masterId', { masterId });
    }

    if (serviceId) {
      query.andWhere('review.serviceId = :serviceId', { serviceId });
    }

    if (status) {
      let statusValue: string;
      if (typeof status === 'string') {
        statusValue = status.toLowerCase();
      } else {
        statusValue = status === ReviewStatus.APPROVED ? 'approved' :
          status === ReviewStatus.PENDING ? 'pending' :
            status === ReviewStatus.REJECTED ? 'rejected' :
              String(status).toLowerCase();
      }
      query.andWhere('review.status = :status', { status: statusValue });
    }

    query.orderBy('review.createdAt', 'DESC');

    const total = await query.getCount();
    const data = await query.skip((p - 1) * l).take(l).getMany();

    return { data, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async moderate(id: string, status: ReviewStatus, moderationComment?: string) {
    const review = await this.reviewRepository.findOne({ where: { id } });

    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }

    const previousStatus = review.status;
    review.status = status;
    if (moderationComment) {
      review.moderationComment = moderationComment;
    }

    const saved = await this.reviewRepository.save(review);

    // При одобрении отзыва начисляем бонусы за отзыв (если настроено)
    if (status === ReviewStatus.APPROVED && previousStatus !== ReviewStatus.APPROVED) {
      const bonusSettings = await this.settingsService.getBonusSettings();
      if (bonusSettings.enabled && bonusSettings.pointsForReview > 0) {
        try {
          await this.financialService.awardBonusPoints(
            review.userId,
            null,
            bonusSettings.pointsForReview,
            'Бонусы за отзыв',
          );
        } catch {
          // Игнорируем ошибку начисления бонусов (например, пользователь удалён)
        }
      }
    }

    // Обновляем рейтинг мастера
    await this.updateMasterRating(review.masterId);

    return saved;
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user', 'master', 'service'],
    });
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    return review;
  }

  async update(id: string, rating?: number, comment?: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        throw new BadRequestException('Рейтинг должен быть от 1 до 5');
      }
      review.rating = rating;
    }
    if (comment !== undefined) {
      review.comment = comment;
    }
    const saved = await this.reviewRepository.save(review);
    await this.updateMasterRating(review.masterId);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    await this.reviewRepository.remove(review);
    await this.updateMasterRating(review.masterId);
  }

  private async updateMasterRating(masterId: string) {
    // Используем QueryBuilder для правильной работы с enum
    const approvedReviews = await this.reviewRepository
      .createQueryBuilder('review')
      .where('review.masterId = :masterId', { masterId })
      .andWhere('review.status = :status', { status: 'approved' })
      .getMany();

    if (approvedReviews.length === 0) {
      return;
    }

    const averageRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;

    await this.masterRepository.update(masterId, {
      rating: Math.round(averageRating * 10) / 10, // Округляем до 1 знака после запятой
    });
  }
}

