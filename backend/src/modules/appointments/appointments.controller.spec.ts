import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditAction } from '../../entities/audit-log.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let appointmentsService: AppointmentsService;
  let auditService: AuditService;

  const mockAppointmentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    reschedule: jest.fn(),
    getAvailableSlots: jest.fn(),
    confirm: jest.fn(),
    cancelByAdmin: jest.fn(),
    delete: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        {
          provide: AppointmentsService,
          useValue: mockAppointmentsService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать запись', async () => {
      const dto: CreateAppointmentDto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date().toISOString(),
      };
      const req = { user: { sub: 'user-1' } };
      const mockAppointment = {
        id: 'appointment-1',
        ...dto,
        clientId: 'user-1',
        status: AppointmentStatus.PENDING,
        price: 1000,
        endTime: new Date(),
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.create.mockResolvedValue(mockAppointment);

      const result = await controller.create(dto, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('findAll', () => {
    it('должен вернуть список записей с фильтрами для обычного пользователя', async () => {
      const req = {
        user: { sub: 'user-1', role: 'client' },
      };
      const mockAppointments = [{ id: 'appointment-1' } as any];

      mockAppointmentsService.findAll.mockResolvedValue(mockAppointments);

      const result = await controller.findAll(
        AppointmentStatus.CONFIRMED,
        '2024-01-01',
        '2024-01-01',
        '2024-01-31',
        'master-1',
        req,
      );

      expect(result).toEqual(mockAppointments);
      expect(mockAppointmentsService.findAll).toHaveBeenCalledWith(
        'user-1',
        AppointmentStatus.CONFIRMED,
        '2024-01-01',
        '2024-01-01',
        '2024-01-31',
        'master-1',
      );
    });

    it('должен вернуть список записей для обычного пользователя', async () => {
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointments: Appointment[] = [
        { id: 'appointment-1' } as Appointment,
      ];

      mockAppointmentsService.findAll.mockResolvedValue(mockAppointments);

      const result = await controller.findAll(undefined, undefined, undefined, undefined, undefined, req);

      expect(result).toEqual(mockAppointments);
      expect(mockAppointmentsService.findAll).toHaveBeenCalledWith('user-1', undefined, undefined, undefined, undefined, undefined);
    });

    it('должен вернуть все записи для админа', async () => {
      const req = { user: { sub: 'admin-1', role: 'admin' } };
      const mockAppointments: Appointment[] = [
        { id: 'appointment-1' } as Appointment,
      ];

      mockAppointmentsService.findAll.mockResolvedValue(mockAppointments);

      const result = await controller.findAll(undefined, undefined, undefined, undefined, undefined, req);

      expect(result).toEqual(mockAppointments);
      expect(mockAppointmentsService.findAll).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, undefined, undefined);
    });

    it('должен вернуть все записи для админа с фильтрами', async () => {
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
      };
      const mockAppointments = [{ id: 'appointment-1' } as any];

      mockAppointmentsService.findAll.mockResolvedValue(mockAppointments);

      const result = await controller.findAll(
        AppointmentStatus.CONFIRMED,
        '2024-01-01',
        '2024-01-01',
        '2024-01-31',
        'master-1',
        req,
      );

      expect(result).toEqual(mockAppointments);
      expect(mockAppointmentsService.findAll).toHaveBeenCalledWith(
        undefined,
        AppointmentStatus.CONFIRMED,
        '2024-01-01',
        '2024-01-01',
        '2024-01-31',
        'master-1',
      );
    });
  });

  describe('findById', () => {
    it('должен вернуть запись по ID', async () => {
      const id = 'appointment-1';
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointment: Appointment = {
        id,
      } as Appointment;

      mockAppointmentsService.findById.mockResolvedValue(mockAppointment);

      const result = await controller.findById(id, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.findById).toHaveBeenCalledWith(id, 'user-1');
    });
  });

  describe('getAvailableSlots', () => {
    it('должен вернуть доступные слоты', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = '2024-01-01';
      const mockSlots = [
        new Date('2024-01-01T10:00:00'),
        new Date('2024-01-01T11:00:00'),
      ];

      mockAppointmentsService.getAvailableSlots.mockResolvedValue(mockSlots);

      const result = await controller.getAvailableSlots(masterId, serviceId, date);

      expect(result).toEqual(mockSlots.map(slot => slot.toISOString()));
      expect(mockAppointmentsService.getAvailableSlots).toHaveBeenCalledWith(
        masterId,
        serviceId,
        new Date(date),
      );
    });
  });

  describe('update', () => {
    it('должен обновить запись', async () => {
      const id = 'appointment-1';
      const dto: UpdateAppointmentDto = {
        status: AppointmentStatus.CONFIRMED,
      };
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointment = {
        id,
        ...dto,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.update.mockResolvedValue(mockAppointment);

      const result = await controller.update(id, dto, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.update).toHaveBeenCalledWith(id, dto, 'user-1');
    });
  });

  describe('cancel', () => {
    it('должен отменить запись', async () => {
      const id = 'appointment-1';
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointment = {
        id,
        status: AppointmentStatus.CANCELLED,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.cancel.mockResolvedValue(mockAppointment);

      const result = await controller.cancel(id, 'reason', req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.cancel).toHaveBeenCalledWith(id, 'user-1', 'reason');
    });
  });

  describe('reschedule', () => {
    it('должен перенести запись', async () => {
      const id = 'appointment-1';
      const dto: RescheduleAppointmentDto = {
        startTime: new Date('2024-01-02T10:00:00').toISOString(),
        reason: 'Перенос по просьбе клиента',
      };
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointment = {
        id,
        status: AppointmentStatus.PENDING,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-02T10:00:00'),
        endTime: new Date('2024-01-02T11:00:00'),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.reschedule.mockResolvedValue(mockAppointment);

      const result = await controller.reschedule(id, dto, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.reschedule).toHaveBeenCalledWith(
        id,
        new Date(dto.startTime),
        'user-1',
        dto.reason,
      );
    });
  });

  describe('patch', () => {
    it('должен частично обновить запись', async () => {
      const id = 'appointment-1';
      const dto: UpdateAppointmentDto = {
        status: AppointmentStatus.CONFIRMED,
      };
      const req = { user: { sub: 'user-1', role: 'client' } };
      const mockAppointment = {
        id,
        ...dto,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.update.mockResolvedValue(mockAppointment);

      const result = await controller.patch(id, dto, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.update).toHaveBeenCalledWith(id, dto, 'user-1');
    });

    it('должен позволить админу частично обновить запись', async () => {
      const id = 'appointment-1';
      const dto: UpdateAppointmentDto = {
        status: AppointmentStatus.CONFIRMED,
      };
      const req = { user: { sub: 'admin-1', role: 'admin' } };
      const mockAppointment = {
        id,
        ...dto,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.update.mockResolvedValue(mockAppointment);

      const result = await controller.patch(id, dto, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.update).toHaveBeenCalledWith(id, dto, undefined);
    });
  });

  describe('confirm', () => {
    it('должен подтвердить запись для админа', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };
      const mockAppointment = {
        id,
        status: AppointmentStatus.CONFIRMED,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.confirm.mockResolvedValue(mockAppointment);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.confirm(id, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.confirm).toHaveBeenCalledWith(id);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'admin-1',
        AuditAction.APPOINTMENT_CONFIRMED,
        expect.objectContaining({
          entityType: 'appointment',
          entityId: id,
        }),
      );
    });

    it('должен выбросить ошибку для не-админа', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'user-1', role: 'client' },
      };

      await expect(controller.confirm(id, req)).rejects.toThrow('Access denied');
      expect(mockAppointmentsService.confirm).not.toHaveBeenCalled();
    });
  });

  describe('cancelByAdmin', () => {
    it('должен отменить запись админом с причиной и логированием', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { reason: 'Test reason' };
      const mockAppointment: Appointment = {
        id,
        status: AppointmentStatus.CANCELLED,
        cancellationReason: 'Test reason',
      } as Appointment;

      mockAppointmentsService.cancelByAdmin.mockResolvedValue(mockAppointment);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.cancelByAdmin(id, body, req as any);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.cancelByAdmin).toHaveBeenCalledWith(id, 'Test reason');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('должен отменить запись админом', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };
      const body = { reason: 'Client request' };
      const mockAppointment = {
        id,
        status: AppointmentStatus.CANCELLED,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
        endTime: new Date(),
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Appointment;

      mockAppointmentsService.cancelByAdmin.mockResolvedValue(mockAppointment);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await controller.cancelByAdmin(id, body, req);

      expect(result).toEqual(mockAppointment);
      expect(mockAppointmentsService.cancelByAdmin).toHaveBeenCalledWith(id, body.reason);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'admin-1',
        AuditAction.APPOINTMENT_CANCELLED,
        expect.objectContaining({
          entityType: 'appointment',
          entityId: id,
        }),
      );
    });

    it('должен выбросить ошибку для не-админа', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'user-1', role: 'client' },
      };
      const body = { reason: 'Test' };

      await expect(controller.cancelByAdmin(id, body, req)).rejects.toThrow('Access denied');
      expect(mockAppointmentsService.cancelByAdmin).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('должен удалить запись для админа', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
      };

      mockAppointmentsService.delete.mockResolvedValue(undefined);

      await controller.delete(id, req);

      expect(mockAppointmentsService.delete).toHaveBeenCalledWith(id);
    });

    it('должен выбросить ошибку для не-админа', async () => {
      const id = 'appointment-1';
      const req = {
        user: { sub: 'user-1', role: 'client' },
      };

      await expect(controller.delete(id, req)).rejects.toThrow('Access denied');
      expect(mockAppointmentsService.delete).not.toHaveBeenCalled();
    });
  });
});

