import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContactRequestsService } from './contact-requests.service';
import { ContactRequest } from '../../entities/contact-request.entity';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';

describe('ContactRequestsService', () => {
  let service: ContactRequestsService;
  let repository: Repository<ContactRequest>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactRequestsService,
        {
          provide: getRepositoryToken(ContactRequest),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ContactRequestsService>(ContactRequestsService);
    repository = module.get<Repository<ContactRequest>>(getRepositoryToken(ContactRequest));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать заявку обратной связи', async () => {
      const dto: CreateContactRequestDto = {
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: 'Хочу записаться на массаж',
      };

      const createdRequest = {
        id: 'request-1',
        ...dto,
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(createdRequest);
      mockRepository.save.mockResolvedValue(createdRequest);

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalledWith(createdRequest);
      expect(result).toEqual(createdRequest);
    });

    it('должен создать заявку без сообщения', async () => {
      const dto: CreateContactRequestDto = {
        name: 'Петр Петров',
        phone: '+79991234568',
      };

      const createdRequest = {
        id: 'request-2',
        ...dto,
        message: null,
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(createdRequest);
      mockRepository.save.mockResolvedValue(createdRequest);

      const result = await service.create(dto);

      expect(result).toEqual(createdRequest);
      expect(result.message).toBeNull();
    });
  });

  describe('findAll', () => {
    it('должен вернуть список заявок с пагинацией', async () => {
      const requests = [
        {
          id: 'request-1',
          name: 'Иван Иванов',
          phone: '+79991234567',
          message: 'Сообщение 1',
          isRead: false,
          isProcessed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'request-2',
          name: 'Петр Петров',
          phone: '+79991234568',
          message: 'Сообщение 2',
          isRead: true,
          isProcessed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([requests, 2]);

      const result = await service.findAll(1, 20);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toEqual(requests);
      expect(result.total).toBe(2);
    });


    it('должен правильно обработать пагинацию', async () => {
      const requests = [];
      mockRepository.findAndCount.mockResolvedValue([requests, 0]);

      const result = await service.findAll(2, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result.data).toEqual(requests);
      expect(result.total).toBe(0);
    });

    it('должен вернуть заявки с фильтрацией по статусу new', async () => {
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

      mockRepository.findAndCount.mockResolvedValue([requests, 1]);

      const result = await service.findAll(1, 20, 'new');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { isRead: false },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toEqual(requests);
      expect(result.total).toBe(1);
    });

    it('должен вернуть обработанные заявки', async () => {
      const requests = [
        {
          id: 'request-1',
          name: 'Иван Иванов',
          phone: '+79991234567',
          isRead: true,
          isProcessed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([requests, 1]);

      const result = await service.findAll(1, 20, 'processed');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { isProcessed: true },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toEqual(requests);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('должен вернуть заявку по ID', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: 'Сообщение',
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(request);

      const result = await service.findOne('request-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      });
      expect(result).toEqual(request);
    });

    it('должен выбросить NotFoundException если заявка не найдена', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Заявка с ID non-existent не найдена',
      );
    });
  });

  describe('update', () => {
    it('должен обновить заявку', async () => {
      const existingRequest = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        message: 'Сообщение',
        isRead: false,
        isProcessed: false,
        comment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateContactRequestDto = {
        isRead: true,
        comment: 'Обработано',
      };

      const updatedRequest = {
        ...existingRequest,
        ...updateDto,
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(existingRequest);
      mockRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.update('request-1', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      });
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...existingRequest,
        ...updateDto,
      });
      expect(result).toEqual(updatedRequest);
    });

    it('должен обновить только указанные поля', async () => {
      const existingRequest = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateContactRequestDto = {
        isProcessed: true,
      };

      const updatedRequest = {
        ...existingRequest,
        ...updateDto,
      };

      mockRepository.findOne.mockResolvedValue(existingRequest);
      mockRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.update('request-1', updateDto);

      expect(result.isProcessed).toBe(true);
      expect(result.isRead).toBe(false);
    });
  });

  describe('remove', () => {
    it('должен удалить заявку', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(request);
      mockRepository.remove.mockResolvedValue(request);

      await service.remove('request-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(request);
    });

    it('должен выбросить NotFoundException если заявка не найдена', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkRemove', () => {
    it('должен удалить несколько заявок', async () => {
      const ids = ['request-1', 'request-2', 'request-3'];

      mockRepository.delete.mockResolvedValue({ affected: 3 });

      await service.bulkDelete(ids);

      expect(mockRepository.delete).toHaveBeenCalledWith(ids);
    });

    it('должен обработать пустой массив', async () => {
      await service.bulkDelete([]);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('должен отметить заявку как прочитанную', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        isRead: false,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRequest = {
        ...request,
        isRead: true,
      };

      mockRepository.findOne.mockResolvedValue(request);
      mockRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.markAsRead('request-1');

      expect(result.isRead).toBe(true);
    });
  });

  describe('markAsProcessed', () => {
    it('должен отметить заявку как обработанную', async () => {
      const request = {
        id: 'request-1',
        name: 'Иван Иванов',
        phone: '+79991234567',
        isRead: true,
        isProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRequest = {
        ...request,
        isProcessed: true,
      };

      mockRepository.findOne.mockResolvedValue(request);
      mockRepository.save.mockResolvedValue(updatedRequest);

      const result = await service.markAsProcessed('request-1');

      expect(result.isProcessed).toBe(true);
    });
  });
});

