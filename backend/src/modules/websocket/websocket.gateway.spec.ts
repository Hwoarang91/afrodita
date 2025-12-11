import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketGateway } from './websocket.gateway';
import { Server, Socket } from 'socket.io';

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockSocket = {
      id: 'test-client-id',
      join: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketGateway],
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('должен логировать подключение клиента', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      gateway.handleConnection(mockSocket as Socket);
      expect(loggerSpy).toHaveBeenCalledWith(`Client connected: ${mockSocket.id}`);
    });
  });

  describe('handleDisconnect', () => {
    it('должен логировать отключение клиента', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      gateway.handleDisconnect(mockSocket as Socket);
      expect(loggerSpy).toHaveBeenCalledWith(`Client disconnected: ${mockSocket.id}`);
    });
  });

  describe('handleSubscribeSlots', () => {
    it('должен подписать клиента на обновления слотов', () => {
      const data = {
        masterId: 'master-1',
        serviceId: 'service-1',
        date: '2024-01-01',
      };

      gateway.handleSubscribeSlots(mockSocket as Socket, data);

      expect(mockSocket.join).toHaveBeenCalledWith('slots:master-1:service-1:2024-01-01');
    });
  });

  describe('emitSlotUpdate', () => {
    it('должен отправить обновление слотов в нужную комнату', () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = '2024-01-01';
      const slots = [new Date('2024-01-01T10:00:00Z'), new Date('2024-01-01T11:00:00Z')];

      gateway.emitSlotUpdate(masterId, serviceId, date, slots);

      expect(mockServer.to).toHaveBeenCalledWith(`slots:${masterId}:${serviceId}:${date}`);
      expect(mockServer.emit).toHaveBeenCalledWith('slot-update', { slots });
    });
  });

  describe('emitNewAppointment', () => {
    it('должен отправить событие о новом назначении всем клиентам', () => {
      const appointment = {
        id: 'appointment-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date(),
      };

      gateway.emitNewAppointment(appointment);

      expect(mockServer.emit).toHaveBeenCalledWith('new-appointment', appointment);
    });
  });

  describe('emitAppointmentStatusChange', () => {
    it('должен отправить событие об изменении статуса назначения', () => {
      const appointmentId = 'appointment-1';
      const status = 'confirmed';

      gateway.emitAppointmentStatusChange(appointmentId, status);

      expect(mockServer.emit).toHaveBeenCalledWith('appointment-status-change', {
        appointmentId,
        status,
      });
    });
  });
});

