import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CacheService } from '../../common/cache/cache.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let serviceRepository: Repository<Service>;
  let masterRepository: Repository<Master>;
  let cacheService: CacheService;

  const mockServiceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMasterRepository = {
    find: jest.fn(),
  };

  const mockCacheService = {
    clearByPattern: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    serviceRepository = module.get<Repository<Service>>(getRepositoryToken(Service));
    masterRepository = module.get<Repository<Master>>(getRepositoryToken(Master));
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('должен вернуть услугу если она существует', async () => {
      const serviceId = 'service-1';
      const mockService: Service = {
        id: serviceId,
        name: 'Test Service',
        price: 1000,
        duration: 60,
      } as Service;

      mockServiceRepository.findOne.mockResolvedValue(mockService);

      const result = await service.findById(serviceId);

      expect(result).toEqual(mockService);
    });

    it('должен выбросить NotFoundException если услуга не найдена', async () => {
      mockServiceRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('должен создать услугу при валидных данных', async () => {
      const dto: CreateServiceDto = {
        name: 'Test Service',
        price: 1000,
        duration: 60,
        description: 'Test Description',
      };

      const mockService: Service = {
        id: 'service-1',
        ...dto,
        isActive: true,
      } as Service;

      mockServiceRepository.create.mockReturnValue(mockService);
      mockServiceRepository.save.mockResolvedValue(mockService);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toEqual(mockService);
      expect(mockServiceRepository.save).toHaveBeenCalled();
    });

    it('должен создать категорию', async () => {
      const dto: CreateServiceDto = {
        name: 'Test Category',
        isCategory: true,
        description: 'Test Description',
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Category',
        isCategory: true,
        price: 0,
        duration: 0,
        isActive: true,
      } as Service;

      mockServiceRepository.create.mockReturnValue(mockService);
      mockServiceRepository.save.mockResolvedValue(mockService);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.isCategory).toBe(true);
      expect(result.price).toBe(0);
      expect(result.duration).toBe(0);
    });
  });

  describe('update', () => {
    it('должен обновить услугу', async () => {
      const serviceId = 'service-1';
      const dto: UpdateServiceDto = {
        name: 'Updated Service',
        price: 1500,
      };

      const existingService: Service = {
        id: serviceId,
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isCategory: false,
        isActive: true,
      } as Service;

      const updatedService: Service = {
        ...existingService,
        ...dto,
      } as Service;

      mockServiceRepository.findOne
        .mockResolvedValueOnce(existingService)
        .mockResolvedValueOnce(updatedService);
      mockServiceRepository.save.mockResolvedValue(updatedService);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.update(serviceId, dto);

      expect(result.name).toBe('Updated Service');
      expect(result.price).toBe(1500);
    });

    it('должен выбросить ошибку если категория имеет цену', async () => {
      const serviceId = 'service-1';
      const dto: UpdateServiceDto = {
        price: 1000,
      };

      const existingService: Service = {
        id: serviceId,
        isCategory: true,
        price: 0,
        duration: 0,
      } as Service;

      mockServiceRepository.findOne.mockResolvedValue(existingService);

      await expect(service.update(serviceId, dto)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('должен деактивировать услугу', async () => {
      const serviceId = 'service-1';
      const mockService: Service = {
        id: serviceId,
        name: 'Test Service',
        isActive: true,
      } as Service;

      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockServiceRepository.save.mockResolvedValue({
        ...mockService,
        isActive: false,
      });
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      await service.delete(serviceId);

      expect(mockServiceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('findAll', () => {
    it('должен вернуть список услуг', async () => {
      const mockServices: Service[] = [
        {
          id: 'service-1',
          name: 'Test Service',
          isActive: true,
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
        getCount: jest.fn().mockResolvedValue(1),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result.data).toEqual(mockServices);
      expect(result.total).toBe(1);
    });
  });

  describe('findSubcategories', () => {
    it('должен вернуть подкатегории', async () => {
      const parentId = 'parent-1';
      const mockSubcategories: Service[] = [
        {
          id: 'sub-1',
          parentServiceId: parentId,
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSubcategories),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findSubcategories(parentId);

      expect(result).toEqual(mockSubcategories);
    });
  });

  describe('findMainServices', () => {
    it('должен вернуть самостоятельные услуги', async () => {
      const mockServices: Service[] = [
        {
          id: 'service-1',
          isCategory: false,
          parentServiceId: null,
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findMainServices();

      expect(result).toEqual(mockServices);
    });
  });

  describe('findCategories - edge cases', () => {
    it('должен вернуть кэшированные данные если они есть', async () => {
      const cachedServices: Service[] = [
        {
          id: 'service-1',
          name: 'Cached Service',
          isCategory: true,
        } as Service,
      ];

      mockCacheService.get.mockReturnValue(cachedServices);

      const result = await service.findCategories();

      expect(result).toEqual(cachedServices);
      expect(mockCacheService.get).toHaveBeenCalledWith('services:categories:true');
      expect(mockServiceRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('должен фильтровать по isActive = false', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockCacheService.get.mockReturnValue(null);
      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findCategories(false);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'service.isActive = :isActive',
        { isActive: false },
      );
    });
  });

  describe('findCategories', () => {
    it('должен вернуть категории', async () => {
      const mockCategories: Service[] = [
        {
          id: 'category-1',
          isCategory: true,
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCategories),
      };

      mockCacheService.get.mockReturnValue(null);
      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.findCategories();

      expect(result).toEqual(mockCategories);
    });

    it('должен использовать кэш если данные есть', async () => {
      const cachedCategories: Service[] = [
        {
          id: 'category-1',
          isCategory: true,
        } as Service,
      ];

      mockCacheService.get.mockReturnValue(cachedCategories);

      const result = await service.findCategories();

      expect(result).toEqual(cachedCategories);
      expect(mockServiceRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findServicesForBot - edge cases', () => {
    it('должен вернуть кэшированные данные если они есть', async () => {
      const cachedServices: Service[] = [
        {
          id: 'service-1',
          name: 'Cached Service',
        } as Service,
      ];

      mockCacheService.get.mockReturnValue(cachedServices);

      const result = await service.findServicesForBot();

      expect(result).toEqual(cachedServices);
      expect(mockCacheService.get).toHaveBeenCalledWith('services:bot:true');
      expect(mockServiceRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('должен кэшировать результат на 5 минут', async () => {
      const mockServices: Service[] = [
        {
          id: 'service-1',
          name: 'Service 1',
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
      };

      mockCacheService.get.mockReturnValue(null);
      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findServicesForBot();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'services:bot:true',
        mockServices,
        300,
      );
    });
  });

  describe('findServicesForBot', () => {
    it('должен вернуть услуги для бота', async () => {
      const mockServices: Service[] = [
        {
          id: 'service-1',
          isCategory: false,
        } as Service,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
      };

      mockCacheService.get.mockReturnValue(null);
      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.findServicesForBot();

      expect(result).toEqual(mockServices);
    });
  });

  describe('create - валидация категорий', () => {
    it('должен выбросить ошибку если категория имеет цену', async () => {
      const dto: CreateServiceDto = {
        name: 'Category',
        description: 'Test',
        isCategory: true,
        price: 1000,
      };

      await expect(service.create(dto)).rejects.toThrow('Категория не может иметь цену');
    });

    it('должен выбросить ошибку если категория имеет длительность', async () => {
      const dto: CreateServiceDto = {
        name: 'Category',
        description: 'Test',
        isCategory: true,
        duration: 60,
      };

      await expect(service.create(dto)).rejects.toThrow('Категория не может иметь длительность');
    });

    it('должен выбросить ошибку если категория является подкатегорией', async () => {
      const dto: CreateServiceDto = {
        name: 'Category',
        description: 'Test',
        isCategory: true,
        parentServiceId: 'parent-1',
      };

      await expect(service.create(dto)).rejects.toThrow('Категория не может быть подкатегорией');
    });

    it('должен выбросить ошибку если allowMultipleSubcategories для не-категории', async () => {
      const dto: CreateServiceDto = {
        name: 'Service',
        description: 'Test',
        isCategory: false,
        allowMultipleSubcategories: true,
        price: 1000,
        duration: 60,
      };

      await expect(service.create(dto)).rejects.toThrow('allowMultipleSubcategories может быть true только для категорий');
    });

    it('должен выбросить ошибку если подкатегория не имеет цены и длительности', async () => {
      const dto: CreateServiceDto = {
        name: 'Subcategory',
        description: 'Test',
        parentServiceId: 'parent-1',
        price: 0,
        duration: 0,
      };

      await expect(service.create(dto)).rejects.toThrow('Подкатегория должна иметь цену и длительность');
    });

    it('должен выбросить ошибку если самостоятельная услуга не имеет цены и длительности', async () => {
      const dto: CreateServiceDto = {
        name: 'Service',
        description: 'Test',
        price: 0,
        duration: 0,
      };

      await expect(service.create(dto)).rejects.toThrow('Самостоятельная услуга должна иметь цену и длительность');
    });
  });

  describe('update', () => {
    it('должен обновить услугу', async () => {
      const id = 'service-1';
      const dto = {
        name: 'Updated Service',
        price: 1500,
      };
      const existingService: Service = {
        id,
        name: 'Service',
        price: 1000,
        duration: 60,
        isCategory: false,
        parentServiceId: null,
      } as Service;
      const updatedService: Service = {
        ...existingService,
        ...dto,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);
      mockServiceRepository.save.mockResolvedValue(updatedService);
      mockServiceRepository.findOne.mockResolvedValueOnce(updatedService);

      const result = await service.update(id, dto);

      expect(result.name).toBe('Updated Service');
      expect(mockCacheService.clearByPattern).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если категория получает цену при обновлении', async () => {
      const id = 'category-1';
      const dto = {
        price: 1000,
      };
      const existingService: Service = {
        id,
        isCategory: true,
        price: 0,
        duration: 0,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValue(existingService);

      await expect(service.update(id, dto)).rejects.toThrow('Категория не может иметь цену');
    });

    it('должен обновить связи с мастерами', async () => {
      const id = 'service-1';
      const dto = {
        masterIds: ['master-1', 'master-2'],
      };
      const existingService: Service = {
        id,
        name: 'Service',
        price: 1000,
        duration: 60,
        isCategory: false,
        parentServiceId: null,
        masters: [],
      } as Service;
      const mockMasters: Master[] = [
        { id: 'master-1' } as Master,
        { id: 'master-2' } as Master,
      ];
      const updatedService: Service = {
        ...existingService,
        masters: mockMasters,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);
      mockMasterRepository.find.mockResolvedValue(mockMasters);
      mockServiceRepository.save.mockResolvedValue(updatedService);
      mockServiceRepository.findOne.mockResolvedValueOnce(updatedService);

      const result = await service.update(id, dto);

      expect(result.masters).toEqual(mockMasters);
    });

    it('должен выбросить ошибку если подкатегория не имеет цены при обновлении', async () => {
      const id = 'subcategory-1';
      const dto = {
        price: 0,
      };
      const existingService: Service = {
        id,
        isCategory: false,
        parentServiceId: 'parent-1',
        price: 0,
        duration: 0,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);

      await expect(service.update(id, dto)).rejects.toThrow('Подкатегория должна иметь цену и длительность');
    });

    it('должен выбросить ошибку если самостоятельная услуга не имеет цены при обновлении', async () => {
      const id = 'service-1';
      const dto = {
        price: 0,
      };
      const existingService: Service = {
        id,
        isCategory: false,
        parentServiceId: null,
        price: 0,
        duration: 0,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);

      await expect(service.update(id, dto)).rejects.toThrow('Самостоятельная услуга должна иметь цену и длительность');
    });

    it('должен выбросить ошибку если категория становится подкатегорией', async () => {
      const id = 'category-1';
      const dto = {
        parentServiceId: 'parent-1',
      };
      const existingService: Service = {
        id,
        isCategory: true,
        parentServiceId: null,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);

      await expect(service.update(id, dto)).rejects.toThrow('Категория не может быть подкатегорией');
    });

    it('должен выбросить ошибку если allowMultipleSubcategories установлен для не-категории', async () => {
      const id = 'service-1';
      const dto = {
        allowMultipleSubcategories: true,
      };
      const existingService: Service = {
        id,
        isCategory: false,
        parentServiceId: null,
      } as Service;

      mockCacheService.clearByPattern.mockResolvedValue(undefined);
      mockServiceRepository.findOne.mockResolvedValueOnce(existingService);

      await expect(service.update(id, dto)).rejects.toThrow('allowMultipleSubcategories может быть true только для категорий');
    });
  });

  describe('findAll - edge cases', () => {
    it('должен фильтровать по search', async () => {
      const search = 'test';
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, 1, 20, search);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(service.name ILIKE :search OR service.description ILIKE :search)',
        { search: `%${search}%` },
      );
    });

    it('должен фильтровать по isActive = false', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, 1, 20, undefined, false);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('service.isActive = :isActive', { isActive: false });
    });

    it('должен включить подкатегории если includeSubcategories = true', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };

      mockServiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, 1, 20, undefined, undefined, true);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith('service.parentServiceId IS NULL', expect.anything());
    });
  });

  describe('delete', () => {
    it('должен деактивировать услугу', async () => {
      const id = 'service-1';
      const existingService: Service = {
        id,
        isActive: true,
      } as Service;
      const deactivatedService: Service = {
        ...existingService,
        isActive: false,
      } as Service;

      mockServiceRepository.findOne.mockResolvedValue(existingService);
      mockServiceRepository.save.mockResolvedValue(deactivatedService);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      await service.delete(id);

      expect(mockServiceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('должен выбросить ошибку при удалении несуществующей услуги', async () => {
      const id = 'non-existent';
      mockServiceRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create - edge cases', () => {
    it('должен обработать создание услуги с минимальной ценой (1)', async () => {
      const dto = {
        name: 'Test Service',
        description: 'Test',
        duration: 15,
        price: 1, // Минимальная цена согласно @Min(0) в DTO
        isCategory: false,
      };

      mockServiceRepository.create.mockReturnValue(dto as Service);
      mockServiceRepository.save.mockResolvedValue({ id: '1', ...dto } as Service);
      mockServiceRepository.findOne.mockResolvedValue({ id: '1', ...dto } as Service);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.price).toBe(1);
    });

    it('должен обработать создание услуги с максимальной длительностью (1440 минут)', async () => {
      const dto = {
        name: 'Test Service',
        description: 'Test',
        duration: 1440, // 24 часа
        price: 1000,
        isCategory: false,
      };

      mockServiceRepository.create.mockReturnValue(dto as Service);
      mockServiceRepository.save.mockResolvedValue({ id: '1', ...dto } as Service);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.duration).toBe(1440);
    });

    it('должен обработать создание услуги с минимальной длительностью (15 минут)', async () => {
      const dto = {
        name: 'Test Service',
        description: 'Test',
        duration: 15,
        price: 1000,
        isCategory: false,
      };

      mockServiceRepository.create.mockReturnValue(dto as Service);
      mockServiceRepository.save.mockResolvedValue({ id: '1', ...dto } as Service);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.duration).toBe(15);
    });

    it('должен обработать создание категории без цены и длительности', async () => {
      const dto = {
        name: 'Category',
        description: 'Category description',
        duration: 0,
        price: 0,
        isCategory: true,
      };

      mockServiceRepository.create.mockReturnValue(dto as Service);
      mockServiceRepository.save.mockResolvedValue({ id: '1', ...dto } as Service);
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.isCategory).toBe(true);
      expect(result.price).toBe(0);
      expect(result.duration).toBe(0);
    });
  });

  describe('update - edge cases', () => {
    it('должен обработать обновление с нулевой ценой', async () => {
      const id = 'service-1';
      const existingService: Service = {
        id,
        name: 'Test',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const updateDto = {
        price: 0,
      };

      mockServiceRepository.findOne.mockResolvedValue(existingService);
      mockServiceRepository.save.mockResolvedValue({
        ...existingService,
        ...updateDto,
      });
      mockCacheService.clearByPattern.mockResolvedValue(undefined);

      const result = await service.update(id, updateDto);

      expect(result.price).toBe(0);
    });

    it('должен обработать обновление с отрицательной длительностью (должна быть ошибка валидации)', async () => {
      const id = 'service-1';
      const existingService: Service = {
        id,
        name: 'Test',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const updateDto = {
        duration: -10,
      };

      mockServiceRepository.findOne.mockResolvedValue(existingService);

      // Валидация должна происходить на уровне DTO, но проверяем что сервис обрабатывает
      await expect(service.update(id, updateDto as any)).rejects.toThrow();
    });
  });
});

