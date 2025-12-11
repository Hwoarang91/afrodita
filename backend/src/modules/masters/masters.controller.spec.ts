import { Test, TestingModule } from '@nestjs/testing';
import { MastersController } from './masters.controller';
import { MastersService } from './masters.service';
import { AuditService } from '../audit/audit.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { Master } from '../../entities/master.entity';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { AuditAction } from '../../entities/audit-log.entity';

describe('MastersController', () => {
  let controller: MastersController;
  let mastersService: MastersService;
  let auditService: AuditService;

  const mockMastersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getSchedule: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    getBlockIntervals: jest.fn(),
    createBlockInterval: jest.fn(),
    deleteBlockInterval: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MastersController],
      providers: [
        {
          provide: MastersService,
          useValue: mockMastersService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<MastersController>(MastersController);
    mastersService = module.get<MastersService>(MastersService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список мастеров', async () => {
      const mockMasters = {
        data: [{ id: 'master-1' } as Master],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockMastersService.findAll.mockResolvedValue(mockMasters);

      const result = await controller.findAll();

      expect(result).toEqual(mockMasters);
      expect(mockMastersService.findAll).toHaveBeenCalledWith(1, 20, undefined, undefined);
    });

    it('должен обработать параметры запроса', async () => {
      const mockMasters = {
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      };

      mockMastersService.findAll.mockResolvedValue(mockMasters);

      const result = await controller.findAll('2', '10', 'search', 'true');

      expect(result).toEqual(mockMasters);
      expect(mockMastersService.findAll).toHaveBeenCalledWith(2, 10, 'search', true);
    });
  });

  describe('findById', () => {
    it('должен вернуть мастера по ID', async () => {
      const id = 'master-1';
      const mockMaster: Master = {
        id,
        name: 'Test Master',
      } as Master;

      mockMastersService.findById.mockResolvedValue(mockMaster);

      const result = await controller.findById(id);

      expect(result).toEqual(mockMaster);
      expect(mockMastersService.findById).toHaveBeenCalledWith(id);
    });
  });

  describe('getSchedule', () => {
    it('должен вернуть расписание мастера', async () => {
      const id = 'master-1';
      const mockSchedule: WorkSchedule[] = [
        {
          id: 'schedule-1',
          masterId: id,
        } as WorkSchedule,
      ];

      mockMastersService.getSchedule.mockResolvedValue(mockSchedule);

      const result = await controller.getSchedule(id);

      expect(result).toEqual(mockSchedule);
      expect(mockMastersService.getSchedule).toHaveBeenCalledWith(id);
    });
  });

  describe('createSchedule', () => {
    it('должен создать расписание', async () => {
      const id = 'master-1';
      const dto: CreateWorkScheduleDto = {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
      };
      const mockSchedule: WorkSchedule = {
        id: 'schedule-1',
        masterId: id,
        ...dto,
      } as WorkSchedule;

      mockMastersService.createSchedule.mockResolvedValue(mockSchedule);

      const result = await controller.createSchedule(id, dto);

      expect(result).toEqual(mockSchedule);
      expect(mockMastersService.createSchedule).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('create', () => {
    it('должен создать нового мастера', async () => {
      const dto: CreateMasterDto = {
        name: 'New Master',
      };
      const mockMaster: Master = {
        id: 'master-1',
        ...dto,
      } as Master;
      const req = {
        user: { sub: 'user-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      mockMastersService.create.mockResolvedValue(mockMaster);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.create(req as any, dto);

      expect(result).toEqual(mockMaster);
      expect(mockMastersService.create).toHaveBeenCalledWith(dto);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('должен создать мастера без логирования если нет пользователя', async () => {
      const dto: CreateMasterDto = {
        name: 'New Master',
      };
      const mockMaster: Master = {
        id: 'master-1',
        ...dto,
      } as Master;
      const req = {};

      mockMastersService.create.mockResolvedValue(mockMaster);

      const result = await controller.create(req as any, dto);

      expect(result).toEqual(mockMaster);
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('должен обновить мастера', async () => {
      const id = 'master-1';
      const dto: UpdateMasterDto = {
        name: 'Updated Master',
      };
      const oldMaster: Master = {
        id,
        name: 'Old Master',
      } as Master;
      const updatedMaster: Master = {
        id,
        name: 'Updated Master',
      } as Master;
      const req = {
        user: { sub: 'user-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      mockMastersService.findById.mockResolvedValue(oldMaster);
      mockMastersService.update.mockResolvedValue(updatedMaster);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.update(req as any, id, dto);

      expect(result).toEqual(updatedMaster);
      expect(mockMastersService.update).toHaveBeenCalledWith(id, dto);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('должен обновить мастера без логирования если нет пользователя', async () => {
      const id = 'master-1';
      const dto: UpdateMasterDto = {
        name: 'Updated Master',
      };
      const oldMaster: Master = {
        id,
        name: 'Old Master',
      } as Master;
      const updatedMaster: Master = {
        id,
        name: 'Updated Master',
      } as Master;
      const req = {};

      mockMastersService.findById.mockResolvedValue(oldMaster);
      mockMastersService.update.mockResolvedValue(updatedMaster);

      const result = await controller.update(req as any, id, dto);

      expect(result).toEqual(updatedMaster);
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('должен удалить мастера', async () => {
      const id = 'master-1';
      const mockMaster: Master = {
        id,
        name: 'Test Master',
      } as Master;
      const req = {
        user: { sub: 'user-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      mockMastersService.findById.mockResolvedValue(mockMaster);
      mockMastersService.delete.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.delete(req as any, id);

      expect(result).toEqual({ message: 'Master deleted successfully' });
      expect(mockMastersService.delete).toHaveBeenCalledWith(id);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('должен удалить мастера без логирования если нет пользователя', async () => {
      const id = 'master-1';
      const mockMaster: Master = {
        id,
        name: 'Test Master',
      } as Master;
      const req = {};

      mockMastersService.findById.mockResolvedValue(mockMaster);
      mockMastersService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(req as any, id);

      expect(result).toEqual({ message: 'Master deleted successfully' });
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('updateSchedule', () => {
    it('должен обновить расписание', async () => {
      const scheduleId = 'schedule-1';
      const dto = {
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '19:00',
      };
      const mockSchedule: WorkSchedule = {
        id: scheduleId,
        ...dto,
      } as WorkSchedule;

      mockMastersService.updateSchedule.mockResolvedValue(mockSchedule);

      const result = await controller.updateSchedule(scheduleId, dto);

      expect(result).toEqual(mockSchedule);
      expect(mockMastersService.updateSchedule).toHaveBeenCalledWith(scheduleId, dto);
    });
  });

  describe('deleteSchedule', () => {
    it('должен удалить расписание', async () => {
      const scheduleId = 'schedule-1';

      mockMastersService.deleteSchedule.mockResolvedValue(undefined);

      const result = await controller.deleteSchedule(scheduleId);

      expect(result).toEqual({ message: 'Schedule deleted successfully' });
      expect(mockMastersService.deleteSchedule).toHaveBeenCalledWith(scheduleId);
    });
  });

  describe('getBlockIntervals', () => {
    it('должен вернуть заблокированные интервалы с датами', async () => {
      const id = 'master-1';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockIntervals = [
        {
          id: 'interval-1',
          masterId: id,
          startTime: new Date(startDate),
          endTime: new Date(endDate),
        },
      ];

      mockMastersService.getBlockIntervals.mockResolvedValue(mockIntervals);

      const result = await controller.getBlockIntervals(id, startDate, endDate);

      expect(result).toEqual(mockIntervals);
      expect(mockMastersService.getBlockIntervals).toHaveBeenCalledWith(
        id,
        new Date(startDate),
        new Date(endDate),
      );
    });

    it('должен вернуть заблокированные интервалы без дат (используя значения по умолчанию)', async () => {
      const id = 'master-1';
      const mockIntervals = [];

      mockMastersService.getBlockIntervals.mockResolvedValue(mockIntervals);

      const result = await controller.getBlockIntervals(id);

      expect(result).toEqual(mockIntervals);
      expect(mockMastersService.getBlockIntervals).toHaveBeenCalled();
    });
  });

  describe('createBlockInterval', () => {
    it('должен создать заблокированный интервал', async () => {
      const id = 'master-1';
      const dto = {
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T12:00:00Z',
        reason: 'Test reason',
      };
      const mockInterval = {
        id: 'interval-1',
        masterId: id,
        ...dto,
      };

      mockMastersService.createBlockInterval.mockResolvedValue(mockInterval);

      const result = await controller.createBlockInterval(id, dto);

      expect(result).toEqual(mockInterval);
      expect(mockMastersService.createBlockInterval).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('deleteBlockInterval', () => {
    it('должен удалить заблокированный интервал', async () => {
      const blockIntervalId = 'interval-1';

      mockMastersService.deleteBlockInterval.mockResolvedValue(undefined);

      const result = await controller.deleteBlockInterval(blockIntervalId);

      expect(result).toEqual({ message: 'Block interval deleted successfully' });
      expect(mockMastersService.deleteBlockInterval).toHaveBeenCalledWith(blockIntervalId);
    });
  });
});

