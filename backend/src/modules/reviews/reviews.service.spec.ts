import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Review, ReviewStatus } from '../../entities/review.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepository: Repository<Review>;
  let appointmentRepository: Repository<Appointment>;
  let masterRepository: Repository<Master>;

  const mockReviewRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  };

  const mockAppointmentRepository = {
    findOne: jest.fn(),
  };

  const mockMasterRepository = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    reviewRepository = module.get<Repository<Review>>(getRepositoryToken(Review));
    appointmentRepository = module.get<Repository<Appointment>>(
      getRepositoryToken(Appointment),
    );
    masterRepository = module.get<Repository<Master>>(getRepositoryToken(Master));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать отзыв при валидных данных', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const rating = 5;
      const comment = 'Great service!';

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        masterId: 'master-1',
        serviceId: 'service-1',
        status: AppointmentStatus.COMPLETED,
        master: {} as Master,
        service: {} as any,
      } as Appointment;

      const mockReview: Review = {
        id: 'review-1',
        userId,
        appointmentId,
        masterId: 'master-1',
        serviceId: 'service-1',
        rating,
        comment,
        status: ReviewStatus.PENDING,
      } as Review;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockReturnValue(mockReview);
      mockReviewRepository.save.mockResolvedValue(mockReview);
      mockReviewRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockReview]),
      });
      mockMasterRepository.update.mockResolvedValue(undefined);

      const result = await service.create(userId, appointmentId, rating, comment);

      expect(result).toEqual(mockReview);
    });

    it('должен выбросить ошибку если рейтинг вне диапазона', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const rating = 6;

      await expect(
        service.create(userId, appointmentId, rating),
      ).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить ошибку если запись не найдена', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const rating = 5;

      mockAppointmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(userId, appointmentId, rating),
      ).rejects.toThrow(NotFoundException);
    });

    it('должен выбросить ошибку если отзыв уже существует', async () => {
      const userId = 'user-1';
      const appointmentId = 'appointment-1';
      const rating = 5;

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        status: AppointmentStatus.COMPLETED,
        master: {} as Master,
        service: {} as any,
      } as Appointment;

      const existingReview: Review = {
        id: 'review-1',
        userId,
        appointmentId,
      } as Review;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockReviewRepository.findOne.mockResolvedValue(existingReview);

      await expect(
        service.create(userId, appointmentId, rating),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('должен вернуть все отзывы', async () => {
      const mockReviews: Review[] = [
        {
          id: 'review-1',
          rating: 5,
          status: ReviewStatus.APPROVED,
        } as Review,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockReviews),
      };

      mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result).toEqual(mockReviews);
    });

    it('должен фильтровать по masterId', async () => {
      const masterId = 'master-1';
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(masterId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'review.masterId = :masterId',
        { masterId },
      );
    });

    it('должен фильтровать по serviceId', async () => {
      const serviceId = 'service-1';
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, serviceId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'review.serviceId = :serviceId',
        { serviceId },
      );
    });

    it('должен фильтровать по status (enum)', async () => {
      const status = ReviewStatus.APPROVED;
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, undefined, status);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('должен фильтровать по status (string)', async () => {
      const status = 'approved' as any;
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, undefined, status);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('create - edge cases', () => {
    it('должен обработать создание отзыва без комментария', async () => {
      const dto = {
        appointmentId: 'appointment-1',
        rating: 5,
      };
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        status: AppointmentStatus.COMPLETED,
        masterId: 'master-1',
        serviceId: 'service-1',
      } as Appointment;
      const mockReview: Review = {
        id: 'review-1',
        ...dto,
        comment: null,
      } as Review;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockReturnValue(mockReview);
      mockReviewRepository.save.mockResolvedValue(mockReview);
      mockReviewRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      mockMasterRepository.update.mockResolvedValue(undefined);

      const result = await service.create('user-1', 'appointment-1', 5);

      expect(result).toEqual(mockReview);
      expect(result.comment).toBeNull();
    });
  });

  describe('moderate', () => {
    it('должен изменить статус отзыва', async () => {
      const reviewId = 'review-1';
      const mockReview: Review = {
        id: reviewId,
        status: ReviewStatus.PENDING,
        masterId: 'master-1',
      } as Review;

      const moderatedReview: Review = {
        ...mockReview,
        status: ReviewStatus.APPROVED,
      } as Review;

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockReviewRepository.save.mockResolvedValue(moderatedReview);
      mockReviewRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([moderatedReview]),
      });
      mockMasterRepository.update.mockResolvedValue(undefined);

      const result = await service.moderate(
        reviewId,
        ReviewStatus.APPROVED,
        'Approved',
      );

      expect(result.status).toBe(ReviewStatus.APPROVED);
    });

    it('должен выбросить ошибку если отзыв не найден', async () => {
      mockReviewRepository.findOne.mockResolvedValue(null);

      await expect(
        service.moderate('non-existent', ReviewStatus.APPROVED),
      ).rejects.toThrow(NotFoundException);
    });

    it('должен добавить комментарий модератора', async () => {
      const reviewId = 'review-1';
      const moderationComment = 'Approved by admin';
      const mockReview: Review = {
        id: reviewId,
        status: ReviewStatus.PENDING,
        masterId: 'master-1',
      } as Review;

      const moderatedReview: Review = {
        ...mockReview,
        status: ReviewStatus.APPROVED,
        moderationComment,
      } as Review;

      mockReviewRepository.findOne.mockResolvedValue(mockReview);
      mockReviewRepository.save.mockResolvedValue(moderatedReview);
      mockReviewRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([moderatedReview]),
      });
      mockMasterRepository.update.mockResolvedValue(undefined);

      const result = await service.moderate(
        reviewId,
        ReviewStatus.APPROVED,
        moderationComment,
      );

      expect(result.moderationComment).toBe(moderationComment);
    });
  });
});


