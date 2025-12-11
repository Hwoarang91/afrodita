import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('SchedulerController', () => {
  let controller: SchedulerController;
  let schedulerService: SchedulerService;

  const mockSchedulerService = {
    sendAppointmentReminders: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulerController],
      providers: [
        {
          provide: SchedulerService,
          useValue: mockSchedulerService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SchedulerController>(SchedulerController);
    schedulerService = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerReminders', () => {
    it('должен вызвать sendAppointmentReminders и вернуть успешный ответ', async () => {
      mockSchedulerService.sendAppointmentReminders.mockResolvedValue(undefined);

      const req = {} as any;
      const result = await controller.triggerReminders(req);

      expect(result).toEqual({
        success: true,
        message: 'Проверка напоминаний запущена',
      });
      expect(mockSchedulerService.sendAppointmentReminders).toHaveBeenCalledTimes(1);
    });

    it('должен обработать ошибку при отправке напоминаний', async () => {
      const error = new Error('Ошибка отправки напоминаний');
      mockSchedulerService.sendAppointmentReminders.mockRejectedValue(error);

      const req = {} as any;

      await expect(controller.triggerReminders(req)).rejects.toThrow(error);
      expect(mockSchedulerService.sendAppointmentReminders).toHaveBeenCalledTimes(1);
    });
  });
});

