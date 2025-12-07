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
  });
});

