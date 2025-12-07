import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from '../../entities/template.entity';
import {
  NotificationType,
  NotificationChannel,
} from '../../entities/notification.entity';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let templateRepository: Repository<Template>;

  const mockTemplateRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: getRepositoryToken(Template),
          useValue: mockTemplateRepository,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    templateRepository = module.get<Repository<Template>>(
      getRepositoryToken(Template),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть все шаблоны', async () => {
      const mockTemplates: Template[] = [
        {
          id: 'template-1',
          name: 'Test Template',
          type: NotificationType.APPOINTMENT_CONFIRMED,
          channel: NotificationChannel.TELEGRAM,
        } as Template,
      ];

      mockTemplateRepository.find.mockResolvedValue(mockTemplates);

      const result = await service.findAll();

      expect(result).toEqual(mockTemplates);
    });
  });

  describe('findOne', () => {
    it('должен вернуть шаблон если он существует', async () => {
      const templateId = 'template-1';
      const mockTemplate: Template = {
        id: templateId,
        name: 'Test Template',
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.findOne(templateId);

      expect(result).toEqual(mockTemplate);
    });

    it('должен выбросить NotFoundException если шаблон не найден', async () => {
      mockTemplateRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByTypeAndChannel', () => {
    it('должен вернуть шаблон по типу и каналу', async () => {
      const mockTemplate: Template = {
        id: 'template-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        channel: NotificationChannel.TELEGRAM,
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.findByTypeAndChannel(
        NotificationType.APPOINTMENT_CONFIRMED,
        NotificationChannel.TELEGRAM,
      );

      expect(result).toEqual(mockTemplate);
    });
  });

  describe('create', () => {
    it('должен создать новый шаблон', async () => {
      const templateData = {
        name: 'Test Template',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        channel: NotificationChannel.TELEGRAM,
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const createdTemplate: Template = {
        id: 'template-1',
        ...templateData,
        isActive: true,
      } as Template;

      mockTemplateRepository.create.mockReturnValue(createdTemplate);
      mockTemplateRepository.save.mockResolvedValue(createdTemplate);

      const result = await service.create(templateData);

      expect(result).toEqual(createdTemplate);
    });
  });

  describe('update', () => {
    it('должен обновить существующий шаблон', async () => {
      const templateId = 'template-1';
      const existingTemplate: Template = {
        id: templateId,
        name: 'Old Name',
      } as Template;

      const updatedTemplate: Template = {
        ...existingTemplate,
        name: 'New Name',
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(existingTemplate);
      mockTemplateRepository.save.mockResolvedValue(updatedTemplate);

      const result = await service.update(templateId, { name: 'New Name' });

      expect(result).toEqual(updatedTemplate);
    });
  });

  describe('delete', () => {
    it('должен удалить шаблон', async () => {
      const templateId = 'template-1';
      const mockTemplate: Template = {
        id: templateId,
        name: 'Test Template',
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);
      mockTemplateRepository.remove.mockResolvedValue(mockTemplate);

      await service.delete(templateId);

      expect(mockTemplateRepository.remove).toHaveBeenCalledWith(mockTemplate);
    });
  });

  describe('preview', () => {
    it('должен вернуть предпросмотр шаблона с данными', async () => {
      const templateId = 'template-1';
      const mockTemplate: Template = {
        id: templateId,
        subject: 'Hello {{name}}',
        body: 'Your appointment is on {{date}}',
      } as Template;

      const sampleData = {
        name: 'John',
        date: '2024-01-01',
      };

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.preview(templateId, sampleData);

      expect(result.subject).toBe('Hello John');
      expect(result.body).toBe('Your appointment is on 2024-01-01');
    });

    it('должен обработать шаблон с отсутствующими переменными', async () => {
      const templateId = 'template-1';
      const mockTemplate: Template = {
        id: templateId,
        subject: 'Test {{missing}}',
        body: 'Body {{missing}}',
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.preview(templateId, {});

      expect(result.subject).toBe('Test ');
      expect(result.body).toBe('Body ');
    });

    it('должен обработать шаблон с вложенными объектами', async () => {
      const templateId = 'template-1';
      const mockTemplate: Template = {
        id: templateId,
        subject: 'Hello {{user.name}}',
        body: 'Welcome {{user.name}}',
      } as Template;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.preview(templateId, { user: { name: 'John' } });

      expect(result.subject).toBe('Hello John');
      expect(result.body).toBe('Welcome John');
    });
  });

  describe('getAvailableVariables - все типы', () => {
    it('должен вернуть переменные для APPOINTMENT_CONFIRMED', () => {
      const result = service.getAvailableVariables(NotificationType.APPOINTMENT_CONFIRMED);
      expect(result).toContain('serviceName');
      expect(result).toContain('masterName');
      expect(result).toContain('startTime');
    });

    it('должен вернуть переменные для APPOINTMENT_CANCELLED', () => {
      const result = service.getAvailableVariables(NotificationType.APPOINTMENT_CANCELLED);
      expect(result).toContain('reason');
      expect(result).toContain('appointmentId');
    });

    it('должен вернуть переменные для APPOINTMENT_RESCHEDULED', () => {
      const result = service.getAvailableVariables(NotificationType.APPOINTMENT_RESCHEDULED);
      expect(result).toContain('oldStartTime');
      expect(result).toContain('startTime');
    });

    it('должен вернуть переменные для BONUS_EARNED', () => {
      const result = service.getAvailableVariables(NotificationType.BONUS_EARNED);
      expect(result).toContain('points');
      expect(result).toContain('totalPoints');
    });

    it('должен вернуть переменные для MARKETING', () => {
      const result = service.getAvailableVariables(NotificationType.MARKETING);
      expect(result).toContain('message');
      expect(result).toContain('clientName');
    });

    it('должен вернуть пустой массив для неизвестного типа', () => {
      const result = service.getAvailableVariables('UNKNOWN' as NotificationType);
      expect(result).toEqual([]);
    });
  });

  describe('getAvailableVariables', () => {
    it('должен вернуть доступные переменные для APPOINTMENT_CONFIRMED', () => {
      const variables = service.getAvailableVariables(
        NotificationType.APPOINTMENT_CONFIRMED,
      );

      expect(variables).toContain('serviceName');
      expect(variables).toContain('masterName');
      expect(variables).toContain('startTime');
    });

    it('должен вернуть доступные переменные для BONUS_EARNED', () => {
      const variables = service.getAvailableVariables(
        NotificationType.BONUS_EARNED,
      );

      expect(variables).toContain('points');
      expect(variables).toContain('totalPoints');
    });
  });
});


