import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ExtraService } from '../../entities/extra-service.entity';
import { CreateExtraServiceDto } from './dto/create-extra-service.dto';
import { UpdateExtraServiceDto } from './dto/update-extra-service.dto';

@Injectable()
export class ExtraServicesService {
  constructor(
    @InjectRepository(ExtraService)
    private readonly extraServiceRepository: Repository<ExtraService>,
  ) {}

  /** Список доп. услуг для веб-приложения (только активные) */
  async findAllActive(): Promise<ExtraService[]> {
    return this.extraServiceRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /** Список для админки с пагинацией */
  async findAll(params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<{ data: ExtraService[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.extraServiceRepository
      .createQueryBuilder('es')
      .orderBy('es.name', 'ASC')
      .skip(skip)
      .take(limit);

    if (params.isActive !== undefined) {
      qb.andWhere('es.isActive = :isActive', { isActive: params.isActive });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<ExtraService> {
    const item = await this.extraServiceRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Extra service not found');
    }
    return item;
  }

  async findByIds(ids: string[]): Promise<ExtraService[]> {
    if (!ids?.length) return [];
    return this.extraServiceRepository.find({ where: { id: In(ids) } });
  }

  async create(dto: CreateExtraServiceDto): Promise<ExtraService> {
    const entity = this.extraServiceRepository.create({
      name: dto.name,
      description: dto.description ?? '',
      price: dto.price,
      icon: dto.icon ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.extraServiceRepository.save(entity);
    return Array.isArray(saved) ? saved[0]! : saved;
  }

  async update(id: string, dto: UpdateExtraServiceDto): Promise<ExtraService> {
    const entity = await this.findById(id);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.price !== undefined) entity.price = dto.price;
    if (dto.icon !== undefined) entity.icon = dto.icon;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    return this.extraServiceRepository.save(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.findById(id);
    await this.extraServiceRepository.remove(entity);
  }
}
