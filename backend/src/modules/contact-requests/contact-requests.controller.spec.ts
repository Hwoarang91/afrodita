import { Test, TestingModule } from '@nestjs/testing';
import { ContactRequestsController } from './contact-requests.controller';
import { ContactRequestsService } from './contact-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';
import { ContactRequest } from '../../entities/contact-request.entity';

describe('ContactRequestsController', () => {
  let controller: ContactRequestsController;
  let service: ContactRequestsService;

  const mockContactRequestsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    bulkDelete: jest.fn(),
    markAsRead: jest.fn(),
    markAsProcessed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactRequestsController],
      providers: [
        {
          provide: ContactRequestsService,
          useValue: mockContactRequestsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContactRequestsController>(ContactRequestsController);
    service = module.get<ContactRequestsService>(ContactRequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать заявку обратной связи (публичный endpoint)', async () => {
      const dto: CreateContactRequestDto = {
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: 'Хочу записаться',
      };

      const createdRequest = {
        id: 'request-1',
        ...dto,
        message: dto.message || null,
        comment: null,
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ContactRequest;

      mockContactRequestsService.create.mockResolvedValue(createdRequest);

      const result = await controller.create(dto);

      expect(mockContactRequestsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(createdRequest);
    });
  });

  describe('findAll', () => {
    it('должен вернуть список заявок с пагинацией', async () => {
      const requests = [
        {
          id: 'request-1',
          name: 'Иван Иванов',
          phone: '+79991234567',
          isRead: false,
          isProcessed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockContactRequestsService.findAll.mockResolvedValue({
        data: requests,
        total: 1,
      });

      const result = await controller.findAll('1', '20', undefined);

      expect(mockContactRequestsService.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result.data).toEqual(requests);
      expect(result.total).toBe(1);
    });

    it('должен применить фильтр по статусу', async () => {
      const requests = [];
      mockContactRequestsService.findAll.mockResolvedValue({
        data: requests,
        total: 0,
      });

      const result = await controller.findAll('1', '20', 'new');

      expect(mockContactRequestsService.findAll).toHaveBeenCalledWith(1, 20, 'new');
      expect(result.data).toEqual(requests);
    });
  });

  describe('findOne', () => {
    it('должен вернуть заявку по ID', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: null,
        comment: null,
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ContactRequest;

      mockContactRequestsService.findOne.mockResolvedValue(request);

      const result = await controller.findOne('request-1');

      expect(mockContactRequestsService.findOne).toHaveBeenCalledWith('request-1');
      expect(result).toEqual(request);
    });
  });

  describe('update', () => {
    it('должен обновить заявку', async () => {
      const updateDto: UpdateContactRequestDto = {
        isRead: true,
        comment: 'Обработано',
      };

      const updatedRequest = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: null,
        ...updateDto,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ContactRequest;

      mockContactRequestsService.update.mockResolvedValue(updatedRequest);

      const result = await controller.update('request-1', updateDto);

      expect(mockContactRequestsService.update).toHaveBeenCalledWith('request-1', updateDto);
      expect(result).toEqual(updatedRequest);
    });
  });

  describe('markAsRead', () => {
    it('должен отметить заявку как прочитанную', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: null,
        comment: null,
        isRead: true,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ContactRequest;

      mockContactRequestsService.markAsRead.mockResolvedValue(request);

      const result = await controller.markAsRead('request-1');

      expect(mockContactRequestsService.markAsRead).toHaveBeenCalledWith('request-1');
      expect(result).toEqual(request);
    });
  });

  describe('markAsProcessed', () => {
    it('должен отметить заявку как обработанную', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: null,
        comment: null,
        isRead: true,
        isProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ContactRequest;

      mockContactRequestsService.markAsProcessed.mockResolvedValue(request);

      const result = await controller.markAsProcessed('request-1');

      expect(mockContactRequestsService.markAsProcessed).toHaveBeenCalledWith('request-1');
      expect(result).toEqual(request);
    });
  });

  describe('remove', () => {
    it('должен удалить заявку', async () => {
      mockContactRequestsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('request-1');

      expect(mockContactRequestsService.remove).toHaveBeenCalledWith('request-1');
      expect(result).toEqual({ message: 'Заявка успешно удалена' });
    });
  });

  describe('bulkDelete', () => {
    it('должен удалить несколько заявок', async () => {
      const ids = ['request-1', 'request-2'];
      mockContactRequestsService.bulkDelete.mockResolvedValue(undefined);

      const result = await controller.bulkDelete({ ids });

      expect(mockContactRequestsService.bulkDelete).toHaveBeenCalledWith(ids);
      expect(result).toEqual({ message: `Успешно удалено ${ids.length} заявок` });
    });
  });
});

