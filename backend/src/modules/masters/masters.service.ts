import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { Appointment } from '../../entities/appointment.entity';
import { CacheService } from '../../common/cache/cache.service';
import { ErrorCode } from '../../common/interfaces/error-response.interface';
import { buildErrorResponse } from '../../common/utils/error-response.builder';
import { normalizePagination } from '../../common/dto/pagination.dto';

@Injectable()
export class MastersService {
  private readonly logger = new Logger(MastersService.name);

  constructor(
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @InjectRepository(BlockInterval)
    private blockIntervalRepository: Repository<BlockInterval>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private cacheService: CacheService,
  ) {}

  async findAll(
    page?: number | string,
    limit?: number | string,
    search?: string,
    isActive?: boolean,
  ): Promise<{ data: Master[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page: p, limit: l } = normalizePagination(page, limit);

    const cacheKey = `masters:all:${isActive ?? 'all'}:${p}:${l}:${search || 'no-search'}`;

    if (p === 1 && !search) {
      const cached = this.cacheService.get<{ data: Master[]; total: number; page: number; limit: number; totalPages: number }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const query = this.masterRepository.createQueryBuilder('master')
      .leftJoinAndSelect('master.services', 'services')
      .leftJoinAndSelect('master.user', 'user');

    if (isActive !== undefined) {
      query.where('master.isActive = :isActive', { isActive });
    }

    if (search) {
      query.andWhere(
        '(master.name ILIKE :search OR master.specialties::text ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('master.name', 'ASC');

    const total = await query.getCount();
    query.skip((p - 1) * l).take(l);

    const data = await query.getMany();

    const result = {
      data,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    };

    if (p === 1 && !search) {
      this.cacheService.set(cacheKey, result, 300); // 5 минут
    }

    return result;
  }

  async findById(id: string): Promise<Master> {
    const master = await this.masterRepository.findOne({
      where: { id },
      relations: ['services', 'user', 'workSchedules'],
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }
    return master;
  }

  async getSchedule(masterId: string): Promise<WorkSchedule[]> {
    return await this.workScheduleRepository.find({
      where: { masterId, isActive: true },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async getBlockIntervals(masterId: string, startDate: Date, endDate: Date): Promise<BlockInterval[]> {
    return await this.blockIntervalRepository.find({
      where: {
        masterId,
      },
    });
  }

  async createSchedule(masterId: string, dto: any): Promise<WorkSchedule> {
    const master = await this.findById(masterId);
    const schedule = this.workScheduleRepository.create({
      masterId: master.id,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return await this.workScheduleRepository.save(schedule);
  }

  async updateSchedule(scheduleId: string, dto: any): Promise<WorkSchedule> {
    const schedule = await this.workScheduleRepository.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException('Work schedule not found');
    }
    if (dto.dayOfWeek !== undefined) schedule.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) schedule.startTime = dto.startTime;
    if (dto.endTime !== undefined) schedule.endTime = dto.endTime;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;
    return await this.workScheduleRepository.save(schedule);
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.workScheduleRepository.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException('Work schedule not found');
    }
    await this.workScheduleRepository.remove(schedule);
  }

  async createBlockInterval(masterId: string, dto: any): Promise<BlockInterval> {
    const master = await this.findById(masterId);
    const blockInterval = this.blockIntervalRepository.create({
      masterId: master.id,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      reason: dto.reason || null,
    });
    return await this.blockIntervalRepository.save(blockInterval);
  }

  async deleteBlockInterval(blockIntervalId: string): Promise<void> {
    const blockInterval = await this.blockIntervalRepository.findOne({
      where: { id: blockIntervalId },
    });
    if (!blockInterval) {
      throw new NotFoundException('Block interval not found');
    }
    await this.blockIntervalRepository.remove(blockInterval);
  }

  async create(dto: any): Promise<Master> {
    // Преобразуем specialization в specialties для совместимости
    const specialties = dto.specialization 
      ? [dto.specialization] 
      : dto.specialties || [];

    // Если bio не указано, но есть specialization, используем specialization как bio
    const bio = dto.bio || dto.specialization || null;

    // Создаём временного пользователя для мастера, если userId не указан
    // В реальном приложении это должно быть через отдельный эндпоинт или при регистрации
    const masterData = {
      name: dto.name,
      bio,
      specialties,
      experience: dto.experience || 0,
      rating: dto.rating || 5.0,
      breakDuration: dto.breakDuration || 15,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      photoUrl: dto.photoUrl || null,
      education: dto.education || null,
    };

    // ВНИМАНИЕ: В реальном приложении userId должен быть обязательным
    // Здесь создаём мастера без привязки к пользователю для совместимости с админкой
    // Это временное решение - в production нужно создавать User сначала
    const master = this.masterRepository.create({
      ...masterData,
      userId: dto.userId || null, // Разрешаем null вместо несуществующего UUID
    });

    const savedMaster = await this.masterRepository.save(master);

    // Связываем мастера с услугами, если указаны serviceIds
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      const services = await this.serviceRepository.find({
        where: { id: In(dto.serviceIds) },
      });
      savedMaster.services = services;
      await this.masterRepository.save(savedMaster);
    }

    return await this.findById(savedMaster.id);
  }

  async update(id: string, dto: any): Promise<Master> {
    this.logger.debug(`Обновление мастера: ${id}`);
    const master = await this.findById(id);
    
    if (dto.specialization) {
      dto.specialties = [dto.specialization];
    }
    
    // Обновляем поля мастера
    if (dto.name !== undefined) master.name = dto.name;
    if (dto.bio !== undefined) {
      master.bio = dto.bio;
    } else if (dto.specialization) {
      // Если bio не указано, но есть specialization, обновляем bio из specialization
      master.bio = dto.specialization;
    }
    if (dto.specialization) {
      master.specialties = [dto.specialization];
    } else if (dto.specialties !== undefined) {
      master.specialties = dto.specialties;
    }
    if (dto.experience !== undefined) master.experience = dto.experience;
    if (dto.rating !== undefined) master.rating = dto.rating;
    if (dto.breakDuration !== undefined) master.breakDuration = dto.breakDuration;
    if (dto.isActive !== undefined) master.isActive = dto.isActive;
    if (dto.photoUrl !== undefined) master.photoUrl = dto.photoUrl;
    if (dto.education !== undefined) master.education = dto.education;

    // Обновляем связи с услугами, если указаны serviceIds
    if (dto.serviceIds !== undefined) {
      if (dto.serviceIds.length > 0) {
        const services = await this.serviceRepository.find({
          where: { id: In(dto.serviceIds) },
        });
        master.services = services;
        this.logger.debug(`Обновлены услуги мастера ${id}: ${services.map(s => s.id).join(', ')}`);
      } else {
        master.services = [];
        this.logger.debug(`Очищены услуги мастера ${id}`);
      }
    }

    await this.masterRepository.save(master);
    const updated = await this.findById(id);
    this.logger.log(`Мастер успешно обновлен: ${updated.id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const master = await this.findById(id);
    
    // Проверяем наличие связанных записей
    const appointmentsCount = await this.appointmentRepository.count({
      where: { masterId: id },
    });
    
    if (appointmentsCount > 0) {
      throw new BadRequestException(
        buildErrorResponse(
          400,
          ErrorCode.VALIDATION_ERROR,
          `Невозможно удалить мастера: у него есть ${appointmentsCount} записей. Сначала удалите или отмените все записи.`
        )
      );
    }
    
    // Удаляем связанные расписания и блокировки
    await this.workScheduleRepository.delete({ masterId: id });
    await this.blockIntervalRepository.delete({ masterId: id });
    
    // Удаляем связи с услугами (many-to-many)
    master.services = [];
    await this.masterRepository.save(master);
    
    // Удаляем мастера
    await this.masterRepository.remove(master);
  }
}

