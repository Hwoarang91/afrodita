import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditAction } from '../../entities/audit-log.entity';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: AuditService;

  const mockAuditService = {
    findAll: jest.fn(),
    findByEntity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    it('должен вернуть логи', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.USER_CREATED,
        },
      ];

      mockAuditService.findAll.mockResolvedValue(mockLogs);

      const result = await controller.getLogs();

      expect(result).toEqual(mockLogs);
    });

    it('должен обработать фильтры', async () => {
      const mockLogs = [];
      const filters = {
        userId: 'user-1',
        action: AuditAction.USER_CREATED,
        entityType: 'user',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z',
        limit: 10,
        offset: 0,
      };

      mockAuditService.findAll.mockResolvedValue(mockLogs);

      const result = await controller.getLogs(
        filters.userId,
        filters.action,
        filters.entityType,
        undefined,
        filters.startDate,
        filters.endDate,
        filters.limit,
        filters.offset,
      );

      expect(result).toEqual(mockLogs);
      expect(mockAuditService.findAll).toHaveBeenCalled();
    });
  });

  describe('getEntityLogs', () => {
    it('должен вернуть логи для сущности', async () => {
      const entityType = 'user';
      const entityId = 'user-1';
      const mockLogs = [
        {
          id: 'log-1',
          entityType,
          entityId,
        },
      ];

      mockAuditService.findByEntity.mockResolvedValue(mockLogs);

      const result = await controller.getEntityLogs(entityType, entityId);

      expect(result).toEqual(mockLogs);
      expect(mockAuditService.findByEntity).toHaveBeenCalledWith(entityType, entityId);
    });
  });
});

