import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus } from '../../entities/review.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
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

  async findAll(masterId?: string, serviceId?: string, status?: ReviewStatus) {
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
      // Преобразуем enum в его строковое значение
      // ReviewStatus.APPROVED = 'approved', ReviewStatus.PENDING = 'pending', ReviewStatus.REJECTED = 'rejected'
      let statusValue: string;
      if (typeof status === 'string') {
        // Если пришла строка, нормализуем её в lowercase
        statusValue = status.toLowerCase();
      } else {
        // Если пришел enum, используем его значение напрямую
        statusValue = status === ReviewStatus.APPROVED ? 'approved' : 
                     status === ReviewStatus.PENDING ? 'pending' : 
                     status === ReviewStatus.REJECTED ? 'rejected' : 
                     String(status).toLowerCase();
      }
      query.andWhere('review.status = :status', { status: statusValue });
    }

    query.orderBy('review.createdAt', 'DESC');

    return await query.getMany();
  }

  async moderate(id: string, status: ReviewStatus, moderationComment?: string) {
    const review = await this.reviewRepository.findOne({ where: { id } });

    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }

    review.status = status;
    if (moderationComment) {
      review.moderationComment = moderationComment;
    }

    const saved = await this.reviewRepository.save(review);

    // Обновляем рейтинг мастера
    await this.updateMasterRating(review.masterId);

    return saved;
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

