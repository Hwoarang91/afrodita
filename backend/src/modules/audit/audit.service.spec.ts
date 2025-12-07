import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction } from '../../entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('должен создать запись аудита', async () => {
      const userId = 'user-1';
      const action = AuditAction.USER_CREATED;
      const options = {
        entityType: 'user',
        entityId: 'user-1',
        description: 'User created',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      const mockLog: AuditLog = {
        id: 'log-1',
        userId,
        action,
        ...options,
        createdAt: new Date(),
      } as AuditLog;

      mockAuditLogRepository.create.mockReturnValue(mockLog);
      mockAuditLogRepository.save.mockResolvedValue(mockLog);

      const result = await service.log(userId, action, options);

      expect(result).toEqual(mockLog);
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        userId,
        action,
        ...options,
      });
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(mockLog);
    });

    it('должен создать запись аудита с минимальными параметрами', async () => {
      const userId = 'user-1';
      const action = AuditAction.USER_CREATED;

      const mockLog: AuditLog = {
        id: 'log-1',
        userId,
        action,
        createdAt: new Date(),
      } as AuditLog;

      mockAuditLogRepository.create.mockReturnValue(mockLog);
      mockAuditLogRepository.save.mockResolvedValue(mockLog);

      const result = await service.log(userId, action);

      expect(result).toEqual(mockLog);
    });
  });

  describe('findAll', () => {
    it('должен вернуть все записи аудита', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: AuditAction.USER_CREATED,
        } as AuditLog,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
    });

    it('должен фильтровать по userId', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ userId: 'user-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.userId = :userId',
        { userId: 'user-1' },
      );
    });

    it('должен фильтровать по action', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ action: AuditAction.USER_CREATED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.action = :action',
        { action: AuditAction.USER_CREATED },
      );
    });

    it('должен фильтровать по датам', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ startDate, endDate });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt >= :startDate',
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt <= :endDate',
        { endDate },
      );
    });

    it('должен применять limit и offset', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(10),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ limit: 20, offset: 10 });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(10);
    });

    it('должен фильтровать по entityType', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ entityType: 'user' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.entityType = :entityType',
        { entityType: 'user' },
      );
    });

    it('должен фильтровать по entityId', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ entityId: 'entity-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.entityId = :entityId',
        { entityId: 'entity-1' },
      );
    });

    it('должен применять все фильтры одновременно', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({
        userId: 'user-1',
        action: AuditAction.USER_UPDATED,
        entityType: 'user',
        entityId: 'user-1',
        startDate,
        endDate,
        limit: 10,
        offset: 5,
      });

      // Проверяем, что все фильтры применены (6 фильтров: userId, action, entityType, entityId, startDate, endDate)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(6);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(5);
    });
  });

  describe('findByEntity', () => {
    it('должен вернуть записи аудита для сущности', async () => {
      const entityType = 'user';
      const entityId = 'user-1';
      const mockLogs: AuditLog[] = [
        {
          id: 'log-1',
          entityType,
          entityId,
        } as AuditLog,
      ];

      mockAuditLogRepository.find.mockResolvedValue(mockLogs);

      const result = await service.findByEntity(entityType, entityId);

      expect(result).toEqual(mockLogs);
      expect(mockAuditLogRepository.find).toHaveBeenCalledWith({
        where: { entityType, entityId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});

