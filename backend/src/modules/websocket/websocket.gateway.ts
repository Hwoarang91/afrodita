import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WSGateway({
  cors: {
    origin: '*',
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger: Logger = new Logger('WebSocketGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-slots')
  handleSubscribeSlots(client: Socket, data: { masterId: string; serviceId: string; date: string }) {
    client.join(`slots:${data.masterId}:${data.serviceId}:${data.date}`);
  }

  emitSlotUpdate(masterId: string, serviceId: string, date: string, slots: Date[]) {
    this.server.to(`slots:${masterId}:${serviceId}:${date}`).emit('slot-update', { slots });
  }

  emitNewAppointment(appointment: any) {
    this.server.emit('new-appointment', appointment);
  }

  emitAppointmentStatusChange(appointmentId: string, status: string) {
    this.server.emit('appointment-status-change', { appointmentId, status });
  }

  // Синхронизация данных между админ панелями
  emitDataSync(type: 'appointment' | 'user' | 'master' | 'service' | 'telegram-chat', action: 'create' | 'update' | 'delete', data: any) {
    this.server.emit('data-sync', { type, action, data });
  }

  emitTelegramMessageSent(chatId: string, messageId: number) {
    this.server.emit('telegram-message-sent', { chatId, messageId });
  }

  emitScheduledMessageStatusChange(messageId: string, status: string) {
    this.server.emit('scheduled-message-status-change', { messageId, status });
  }
}

