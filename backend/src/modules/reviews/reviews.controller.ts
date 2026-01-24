import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuthRequest } from '../../common/types/request.types';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ReviewStatus } from '../../entities/review.entity';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Создание отзыва' })
  async create(
    @Request() req: AuthRequest,
    @Body() body: { appointmentId: string; rating: number; comment?: string },
  ) {
    return await this.reviewsService.create(req.user!.sub!, body.appointmentId, body.rating, body.comment);
  }

  @Get()
  @ApiOperation({ summary: 'Получение списка отзывов (с пагинацией)' })
  async findAll(
    @Query('masterId') masterId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    let normalizedStatus: ReviewStatus | string | undefined = status;
    if (status) {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'approved' || lowerStatus === 'pending' || lowerStatus === 'rejected') {
        normalizedStatus = lowerStatus;
      }
    }
    return await this.reviewsService.findAll(masterId, serviceId, normalizedStatus as ReviewStatus | undefined, page, limit);
  }

  @Post(':id/moderate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Модерация отзыва (только для админов)' })
  async moderate(
    @Param('id') id: string,
    @Body() body: { status: ReviewStatus; moderationComment?: string },
  ) {
    return await this.reviewsService.moderate(id, body.status, body.moderationComment);
  }
}

