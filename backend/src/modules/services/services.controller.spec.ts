import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from '../../entities/service.entity';

describe('ServicesController', () => {
  let controller: ServicesController;
  let servicesService: ServicesService;

  const mockServicesService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findSubcategories: jest.fn(),
    findMainServices: jest.fn(),
    findCategories: jest.fn(),
    findServicesForBot: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        {
          provide: ServicesService,
          useValue: mockServicesService,
        },
      ],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
    servicesService = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список услуг', async () => {
      const mockServices = {
        data: [{ id: 'service-1' } as Service],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockServicesService.findAll.mockResolvedValue(mockServices);

      const result = await controller.findAll();

      expect(result).toEqual(mockServices);
      expect(mockServicesService.findAll).toHaveBeenCalledWith(
        undefined,
        1,
        20,
        undefined,
        undefined,
        false,
      );
    });

    it('должен обработать параметры запроса', async () => {
      const mockServices = {
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      };

      mockServicesService.findAll.mockResolvedValue(mockServices);

      const result = await controller.findAll('category-1', '2', '10', 'search', 'true', 'true');

      expect(result).toEqual(mockServices);
      expect(mockServicesService.findAll).toHaveBeenCalledWith(
        'category-1',
        2,
        10,
        'search',
        true,
        true,
      );
    });
  });

  describe('findById', () => {
    it('должен вернуть услугу по ID', async () => {
      const id = 'service-1';
      const mockService: Service = {
        id,
        name: 'Test Service',
      } as Service;

      mockServicesService.findById.mockResolvedValue(mockService);

      const result = await controller.findById(id);

      expect(result).toEqual(mockService);
      expect(mockServicesService.findById).toHaveBeenCalledWith(id);
    });
  });

  describe('findSubcategories', () => {
    it('должен вернуть подкатегории', async () => {
      const id = 'service-1';
      const mockSubcategories: Service[] = [
        { id: 'sub-1', parentServiceId: id } as Service,
      ];

      mockServicesService.findSubcategories.mockResolvedValue(mockSubcategories);

      const result = await controller.findSubcategories(id);

      expect(result).toEqual(mockSubcategories);
      expect(mockServicesService.findSubcategories).toHaveBeenCalledWith(id);
    });
  });

  describe('findMainServices', () => {
    it('должен вернуть самостоятельные услуги', async () => {
      const mockServices: Service[] = [
        { id: 'service-1' } as Service,
      ];

      mockServicesService.findMainServices.mockResolvedValue(mockServices);

      const result = await controller.findMainServices();

      expect(result).toEqual(mockServices);
      expect(mockServicesService.findMainServices).toHaveBeenCalled();
    });
  });

  describe('findCategories', () => {
    it('должен вернуть категории', async () => {
      const mockCategories: Service[] = [
        { id: 'category-1', isCategory: true } as Service,
      ];

      mockServicesService.findCategories.mockResolvedValue(mockCategories);

      const result = await controller.findCategories();

      expect(result).toEqual(mockCategories);
      expect(mockServicesService.findCategories).toHaveBeenCalled();
    });
  });

  describe('findServicesForBot', () => {
    it('должен вернуть услуги для бота', async () => {
      const mockServices: Service[] = [
        { id: 'service-1' } as Service,
      ];

      mockServicesService.findServicesForBot.mockResolvedValue(mockServices);

      const result = await controller.findServicesForBot();

      expect(result).toEqual(mockServices);
      expect(mockServicesService.findServicesForBot).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('должен создать новую услугу', async () => {
      const dto: CreateServiceDto = {
        name: 'New Service',
        description: 'Test',
        price: 1000,
        duration: 60,
      };
      const mockService: Service = {
        id: 'service-1',
        ...dto,
      } as Service;

      mockServicesService.create.mockResolvedValue(mockService);

      const result = await controller.create(dto);

      expect(result).toEqual(mockService);
      expect(mockServicesService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('должен обновить услугу', async () => {
      const id = 'service-1';
      const dto: UpdateServiceDto = {
        name: 'Updated Service',
      };
      const mockService: Service = {
        id,
        name: 'Updated Service',
      } as Service;

      mockServicesService.update.mockResolvedValue(mockService);

      const result = await controller.update(id, dto);

      expect(result).toEqual(mockService);
      expect(mockServicesService.update).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('delete', () => {
    it('должен удалить услугу', async () => {
      const id = 'service-1';

      mockServicesService.delete.mockResolvedValue(undefined);

      await controller.delete(id);

      expect(mockServicesService.delete).toHaveBeenCalledWith(id);
    });
  });
});

