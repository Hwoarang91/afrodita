import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Review, ReviewStatus } from '../../entities/review.entity';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviewsService: ReviewsService;

  const mockReviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    moderate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    reviewsService = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать отзыв', async () => {
      const req = { user: { sub: 'user-1' } };
      const body = {
        appointmentId: 'appointment-1',
        rating: 5,
        comment: 'Great service!',
      };
      const mockReview: Review = {
        id: 'review-1',
        userId: 'user-1',
        appointmentId: body.appointmentId,
        rating: body.rating,
        comment: body.comment,
      } as Review;

      mockReviewsService.create.mockResolvedValue(mockReview);

      const result = await controller.create(req, body);

      expect(result).toEqual(mockReview);
      expect(mockReviewsService.create).toHaveBeenCalledWith(
        'user-1',
        body.appointmentId,
        body.rating,
        body.comment,
      );
    });
  });

  describe('findAll', () => {
    it('должен вернуть список отзывов', async () => {
      const mockReviews: Review[] = [
        { id: 'review-1', rating: 5 } as Review,
      ];

      mockReviewsService.findAll.mockResolvedValue(mockReviews);

      const result = await controller.findAll();

      expect(result).toEqual(mockReviews);
    });

    it('должен фильтровать по masterId', async () => {
      const masterId = 'master-1';
      const mockReviews: Review[] = [];

      mockReviewsService.findAll.mockResolvedValue(mockReviews);

      const result = await controller.findAll(masterId);

      expect(result).toEqual(mockReviews);
      expect(mockReviewsService.findAll).toHaveBeenCalledWith(masterId, undefined, undefined);
    });
  });

  describe('moderate', () => {
    it('должен модерировать отзыв', async () => {
      const id = 'review-1';
      const body = {
        status: ReviewStatus.APPROVED,
        moderationComment: 'Approved',
      };
      const mockReview: Review = {
        id,
        status: ReviewStatus.APPROVED,
      } as Review;

      mockReviewsService.moderate.mockResolvedValue(mockReview);

      const result = await controller.moderate(id, body);

      expect(result).toEqual(mockReview);
      expect(mockReviewsService.moderate).toHaveBeenCalledWith(
        id,
        body.status,
        body.moderationComment,
      );
    });
  });
});

