import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    action: AuditAction,
    options: {
      entityType?: string;
      entityId?: string;
      description?: string;
      changes?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      userId,
      action,
      entityType: options.entityType,
      entityId: options.entityId,
      description: options.description,
      changes: options.changes,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return await this.auditLogRepository.save(log);
  }

  async findAll(
    filters: {
      userId?: string;
      action?: AuditAction;
      entityType?: string;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (filters.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }

    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters.entityType) {
      query.andWhere('log.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters.entityId) {
      query.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters.startDate) {
      query.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const total = await query.getCount();

    if (filters.limit) {
      query.limit(filters.limit);
    }

    if (filters.offset) {
      query.offset(filters.offset);
    }

    const logs = await query.getMany();

    return { logs, total };
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}

