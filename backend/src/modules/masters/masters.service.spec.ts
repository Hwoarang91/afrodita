import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MastersService } from './masters.service';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { WorkSchedule, DayOfWeek } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { Appointment } from '../../entities/appointment.entity';
import { CacheService } from '../../common/cache/cache.service';

describe('MastersService', () => {
  let service: MastersService;
  let masterRepository: Repository<Master>;
  let workScheduleRepository: Repository<WorkSchedule>;
  let blockIntervalRepository: Repository<BlockInterval>;

  const mockMasterRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockServiceRepository = {
    find: jest.fn(),
  };

  const mockWorkScheduleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockBlockIntervalRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockAppointmentRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastersService,
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
        {
          provide: getRepositoryToken(WorkSchedule),
          useValue: mockWorkScheduleRepository,
        },
        {
          provide: getRepositoryToken(BlockInterval),
          useValue: mockBlockIntervalRepository,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<MastersService>(MastersService);
    masterRepository = module.get<Repository<Master>>(getRepositoryToken(Master));
    workScheduleRepository = module.get<Repository<WorkSchedule>>(
      getRepositoryToken(WorkSchedule),
    );
    blockIntervalRepository = module.get<Repository<BlockInterval>>(
      getRepositoryToken(BlockInterval),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список мастеров с фильтром isActive', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'master-1' } as Master]),
      };

      mockMasterRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.get.mockReturnValue(null);
      mockCacheService.set.mockReturnValue(undefined);

      const result = await service.findAll(1, 20, undefined, true);

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('master.isActive = :isActive', { isActive: true });
    });

    it('должен вернуть список мастеров с поиском', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'master-1' } as Master]),
      };

      mockMasterRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.get.mockReturnValue(null);

      const result = await service.findAll(1, 20, 'test', undefined);

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('должен вернуть список мастеров', async () => {
      const mockMasters: Master[] = [
        {
          id: 'master-1',
          name: 'Test Master',
          isActive: true,
        } as Master,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue(mockMasters),
      };

      mockMasterRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.get.mockReturnValue(null);

      const result = await service.findAll();

      expect(result.data).toEqual(mockMasters);
      expect(result.total).toBe(1);
    });

    it('должен использовать кэш для первой страницы', async () => {
      const cachedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      mockCacheService.get.mockReturnValue(cachedResult);

      const result = await service.findAll();

      expect(result).toEqual(cachedResult);
      expect(mockMasterRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('должен вернуть мастера если он существует', async () => {
      const masterId = 'master-1';
      const mockMaster: Master = {
        id: masterId,
        name: 'Test Master',
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);

      const result = await service.findById(masterId);

      expect(result).toEqual(mockMaster);
    });

    it('должен выбросить NotFoundException если мастер не найден', async () => {
      mockMasterRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSchedule', () => {
    it('должен вернуть расписание мастера', async () => {
      const masterId = 'master-1';
      const mockSchedule: WorkSchedule[] = [
        {
          id: 'schedule-1',
          masterId,
          dayOfWeek: DayOfWeek.MONDAY,
          isActive: true,
        } as WorkSchedule,
      ];

      mockWorkScheduleRepository.find.mockResolvedValue(mockSchedule);

      const result = await service.getSchedule(masterId);

      expect(result).toEqual(mockSchedule);
    });
  });

  describe('getBlockIntervals', () => {
    it('должен вернуть заблокированные интервалы', async () => {
      const masterId = 'master-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockIntervals: BlockInterval[] = [
        {
          id: 'interval-1',
          masterId,
          startTime: startDate,
          endTime: endDate,
        } as BlockInterval,
      ];

      mockBlockIntervalRepository.find.mockResolvedValue(mockIntervals);

      const result = await service.getBlockIntervals(masterId, startDate, endDate);

      expect(result).toEqual(mockIntervals);
    });
  });

  describe('createSchedule', () => {
    it('должен создать расписание для мастера', async () => {
      const masterId = 'master-1';
      const dto = {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      };
      const mockMaster: Master = {
        id: masterId,
        name: 'Test Master',
      } as Master;
      const mockSchedule: WorkSchedule = {
        id: 'schedule-1',
        masterId,
        ...dto,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockWorkScheduleRepository.create.mockReturnValue(mockSchedule);
      mockWorkScheduleRepository.save.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule(masterId, dto);

      expect(result).toEqual(mockSchedule);
    });
  });

  describe('updateSchedule', () => {
    it('должен обновить расписание', async () => {
      const scheduleId = 'schedule-1';
      const dto = {
        startTime: '10:00',
        endTime: '19:00',
      };
      const existingSchedule: WorkSchedule = {
        id: scheduleId,
        masterId: 'master-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
      } as WorkSchedule;
      const updatedSchedule: WorkSchedule = {
        ...existingSchedule,
        ...dto,
      } as WorkSchedule;

      mockWorkScheduleRepository.findOne.mockResolvedValue(existingSchedule);
      mockWorkScheduleRepository.save.mockResolvedValue(updatedSchedule);

      const result = await service.updateSchedule(scheduleId, dto);

      expect(result).toEqual(updatedSchedule);
    });

    it('должен выбросить NotFoundException если расписание не найдено', async () => {
      mockWorkScheduleRepository.findOne.mockResolvedValue(null);

      await expect(service.updateSchedule('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteSchedule', () => {
    it('должен удалить расписание', async () => {
      const scheduleId = 'schedule-1';
      const mockSchedule: WorkSchedule = {
        id: scheduleId,
      } as WorkSchedule;

      mockWorkScheduleRepository.findOne.mockResolvedValue(mockSchedule);
      mockWorkScheduleRepository.remove.mockResolvedValue(mockSchedule);

      await service.deleteSchedule(scheduleId);

      expect(mockWorkScheduleRepository.remove).toHaveBeenCalledWith(mockSchedule);
    });
  });

  describe('createBlockInterval', () => {
    it('должен создать заблокированный интервал', async () => {
      const masterId = 'master-1';
      const dto = {
        startTime: '2024-01-01T10:00:00',
        endTime: '2024-01-01T12:00:00',
        reason: 'Break',
      };
      const mockMaster: Master = {
        id: masterId,
      } as Master;
      const mockInterval: BlockInterval = {
        id: 'interval-1',
        masterId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        reason: dto.reason,
      } as BlockInterval;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockBlockIntervalRepository.create.mockReturnValue(mockInterval);
      mockBlockIntervalRepository.save.mockResolvedValue(mockInterval);

      const result = await service.createBlockInterval(masterId, dto);

      expect(result).toEqual(mockInterval);
    });
  });

  describe('update - edge cases', () => {
    it('должен обработать обновление с specialization', async () => {
      const id = 'master-1';
      const dto = {
        specialization: 'Test specialization',
      };
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        specialties: [],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue({
        ...mockMaster,
        specialties: [dto.specialization],
      } as Master);

      const result = await service.update(id, dto);

      expect(result.specialties).toContain(dto.specialization);
    });

    it('должен обработать обновление с serviceIds (пустой массив)', async () => {
      const id = 'master-1';
      const dto = {
        serviceIds: [],
      };
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        services: [],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue({
        ...mockMaster,
        services: [],
      } as Master);

      const result = await service.update(id, dto);

      expect(result.services).toEqual([]);
    });
  });

  describe('deleteBlockInterval', () => {
    it('должен удалить заблокированный интервал', async () => {
      const intervalId = 'interval-1';
      const mockInterval: BlockInterval = {
        id: intervalId,
      } as BlockInterval;

      mockBlockIntervalRepository.findOne.mockResolvedValue(mockInterval);
      mockBlockIntervalRepository.remove.mockResolvedValue(mockInterval);

      await service.deleteBlockInterval(intervalId);

      expect(mockBlockIntervalRepository.remove).toHaveBeenCalledWith(mockInterval);
    });

    it('должен выбросить NotFoundException если интервал не найден', async () => {
      const intervalId = 'interval-1';

      mockBlockIntervalRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteBlockInterval(intervalId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('должен создать мастера', async () => {
      const dto = {
        name: 'New Master',
        bio: 'Test bio',
        specialties: ['Haircut'],
        experience: 5,
        rating: 4.5,
        breakDuration: 15,
        isActive: true,
      };

      const mockMaster: Master = {
        id: 'master-1',
        ...dto,
        userId: '00000000-0000-0000-0000-000000000000',
        services: [],
      } as Master;

      mockMasterRepository.create.mockReturnValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue(mockMaster);
      mockMasterRepository.findOne.mockResolvedValue(mockMaster);

      const result = await service.create(dto);

      expect(result).toEqual(mockMaster);
      expect(mockMasterRepository.create).toHaveBeenCalled();
    });

    it('должен создать мастера с serviceIds', async () => {
      const dto = {
        name: 'New Master',
        serviceIds: ['service-1', 'service-2'],
      };

      const mockServices: Service[] = [
        { id: 'service-1' } as Service,
        { id: 'service-2' } as Service,
      ];

      const mockMaster: Master = {
        id: 'master-1',
        name: 'New Master',
        services: [],
      } as Master;

      mockMasterRepository.create.mockReturnValue(mockMaster);
      mockMasterRepository.save
        .mockResolvedValueOnce(mockMaster)
        .mockResolvedValueOnce({ ...mockMaster, services: mockServices } as Master);
      mockServiceRepository.find.mockResolvedValue(mockServices);
      mockMasterRepository.findOne.mockResolvedValue({ ...mockMaster, services: mockServices } as Master);

      const result = await service.create(dto);

      expect(result.services).toEqual(mockServices);
      expect(mockServiceRepository.find).toHaveBeenCalled();
    });

    it('должен создать мастера с specialization вместо bio', async () => {
      const dto = {
        name: 'New Master',
        specialization: 'Haircut specialist',
      };

      const mockMaster: Master = {
        id: 'master-1',
        name: 'New Master',
        bio: 'Haircut specialist',
        specialties: ['Haircut specialist'],
        userId: '00000000-0000-0000-0000-000000000000',
      } as Master;

      mockMasterRepository.create.mockReturnValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue(mockMaster);
      mockMasterRepository.findOne.mockResolvedValue(mockMaster);

      const result = await service.create(dto);

      expect(result.bio).toBe('Haircut specialist');
      expect(result.specialties).toEqual(['Haircut specialist']);
    });
  });

  describe('update', () => {
    it('должен обновить мастера с bio', async () => {
      const id = 'master-1';
      const dto = {
        bio: 'Updated bio',
      };
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        bio: 'Old bio',
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue({
        ...mockMaster,
        bio: 'Updated bio',
      } as Master);

      const result = await service.update(id, dto);

      expect(result.bio).toBe('Updated bio');
    });

    it('должен обновить мастера с specialization (обновляет bio)', async () => {
      const id = 'master-1';
      const dto = {
        specialization: 'New specialization',
      };
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        bio: 'Old bio',
        specialties: ['Old'],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockMasterRepository.save.mockResolvedValue({
        ...mockMaster,
        bio: 'New specialization',
        specialties: ['New specialization'],
      } as Master);

      const result = await service.update(id, dto);

      expect(result.bio).toBe('New specialization');
      expect(result.specialties).toEqual(['New specialization']);
    });

    it('должен обновить мастера с serviceIds (непустой массив)', async () => {
      const id = 'master-1';
      const dto = {
        serviceIds: ['service-1', 'service-2'],
      };
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        services: [],
      } as Master;
      const mockServices: Service[] = [
        { id: 'service-1' } as Service,
        { id: 'service-2' } as Service,
      ];

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.find.mockResolvedValue(mockServices);
      mockMasterRepository.save.mockResolvedValue({
        ...mockMaster,
        services: mockServices,
      } as Master);

      const result = await service.update(id, dto);

      expect(result.services).toEqual(mockServices);
      expect(mockServiceRepository.find).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('должен удалить мастера', async () => {
      const id = 'master-1';
      const mockMaster: Master = {
        id,
        name: 'Test Master',
        services: [],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockWorkScheduleRepository.delete.mockResolvedValue({ affected: 1 });
      mockBlockIntervalRepository.delete.mockResolvedValue({ affected: 1 });
      mockMasterRepository.save.mockResolvedValue(mockMaster);
      mockMasterRepository.remove.mockResolvedValue(mockMaster);

      await service.delete(id);

      expect(mockMasterRepository.remove).toHaveBeenCalledWith(mockMaster);
      expect(mockWorkScheduleRepository.delete).toHaveBeenCalledWith({ masterId: id });
      expect(mockBlockIntervalRepository.delete).toHaveBeenCalledWith({ masterId: id });
    });

    it('должен выбросить BadRequestException если у мастера есть записи', async () => {
      const id = 'master-1';
      const mockMaster: Master = {
        id,
        name: 'Test Master',
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockAppointmentRepository.count.mockResolvedValue(5);

      await expect(service.delete(id)).rejects.toThrow('Невозможно удалить мастера');
    });

    it('должен выбросить NotFoundException если мастер не найден', async () => {
      const id = 'master-1';

      mockMasterRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSchedule', () => {
    it('должен выбросить NotFoundException если расписание не найдено', async () => {
      const scheduleId = 'schedule-1';

      mockWorkScheduleRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteSchedule(scheduleId)).rejects.toThrow(NotFoundException);
    });
  });
});


