import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationType, NotificationChannel } from '../../entities/notification.entity';
import { Template } from '../../entities/template.entity';

describe('TemplatesController', () => {
  let controller: TemplatesController;
  let templatesService: TemplatesService;

  const mockTemplatesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    preview: jest.fn(),
    getAvailableVariables: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TemplatesController>(TemplatesController);
    templatesService = module.get<TemplatesService>(TemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список шаблонов', async () => {
      const mockTemplates: Template[] = [
        { id: 'template-1' } as Template,
      ];

      mockTemplatesService.findAll.mockResolvedValue(mockTemplates);

      const result = await controller.findAll();

      expect(result).toEqual(mockTemplates);
    });
  });

  describe('findOne', () => {
    it('должен вернуть шаблон по ID', async () => {
      const id = 'template-1';
      const mockTemplate: Template = {
        id,
      } as Template;

      mockTemplatesService.findOne.mockResolvedValue(mockTemplate);

      const result = await controller.findOne(id);

      expect(result).toEqual(mockTemplate);
    });
  });

  describe('getVariables', () => {
    it('должен вернуть доступные переменные', async () => {
      const type = NotificationType.APPOINTMENT_CONFIRMED;
      const mockVariables = ['appointmentId', 'serviceName'];

      mockTemplatesService.getAvailableVariables.mockReturnValue(mockVariables);

      const result = await controller.getVariables(type);

      expect(result).toEqual({ variables: mockVariables });
    });
  });

  describe('create', () => {
    it('должен создать шаблон', async () => {
      const dto = {
        name: 'Test Template',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        channel: NotificationChannel.TELEGRAM,
        subject: 'Test',
        body: 'Test body',
      };
      const mockTemplate: Template = {
        id: 'template-1',
        ...dto,
      } as Template;

      mockTemplatesService.create.mockResolvedValue(mockTemplate);

      const result = await controller.create(dto);

      expect(result).toEqual(mockTemplate);
    });
  });

  describe('update', () => {
    it('должен обновить шаблон', async () => {
      const id = 'template-1';
      const dto = {
        subject: 'Updated',
      };
      const mockTemplate: Template = {
        id,
        ...dto,
      } as Template;

      mockTemplatesService.update.mockResolvedValue(mockTemplate);

      const result = await controller.update(id, dto);

      expect(result).toEqual(mockTemplate);
    });
  });

  describe('delete', () => {
    it('должен удалить шаблон', async () => {
      const id = 'template-1';

      mockTemplatesService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(id);

      expect(result).toEqual({ message: 'Шаблон удален' });
    });
  });

  describe('preview', () => {
    it('должен вернуть предпросмотр шаблона', async () => {
      const id = 'template-1';
      const dto = {
        sampleData: { serviceName: 'Test Service' },
      };
      const mockPreview = {
        subject: 'Test',
        body: 'Test body',
      };

      mockTemplatesService.preview.mockResolvedValue(mockPreview);

      const result = await controller.preview(id, dto);

      expect(result).toEqual(mockPreview);
    });
  });
});

