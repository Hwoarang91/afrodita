import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ScheduledMessage, ScheduledMessageStatus, ScheduledMessageType } from '../../entities/scheduled-message.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelegramService } from './telegram.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    @InjectRepository(ScheduledMessage)
    private scheduledMessageRepository: Repository<ScheduledMessage>,
    private telegramService: TelegramService,
    @Inject(forwardRef(() => WebSocketGateway))
    private webSocketGateway: WebSocketGateway,
  ) {}

  async findAll(): Promise<ScheduledMessage[]> {
    return await this.scheduledMessageRepository.find({
      order: { scheduledAt: 'ASC' },
    });
  }

  async findPending(): Promise<ScheduledMessage[]> {
    return await this.scheduledMessageRepository.find({
      where: {
        status: ScheduledMessageStatus.PENDING,
        scheduledAt: LessThanOrEqual(new Date()),
      },
      order: { scheduledAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ScheduledMessage> {
    const message = await this.scheduledMessageRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('Запланированное сообщение не найдено');
    }
    return message;
  }

  async findByChatId(chatId: string): Promise<ScheduledMessage[]> {
    return await this.scheduledMessageRepository.find({
      where: { chatId },
      order: { scheduledAt: 'ASC' },
    });
  }

  async create(data: {
    chatId: string;
    type: ScheduledMessageType;
    message?: string;
    mediaUrl?: string;
    caption?: string;
    pollOptions?: string[];
    scheduledAt: Date;
    isRecurring?: boolean;
    recurringPattern?: string;
    recurringConfig?: Record<string, any>;
    recurringEndDate?: Date;
  }): Promise<ScheduledMessage> {
    const scheduledMessage = this.scheduledMessageRepository.create({
      chatId: data.chatId,
      type: data.type,
      message: data.message || null,
      mediaUrl: data.mediaUrl || null,
      caption: data.caption || null,
      pollOptions: data.pollOptions || null,
      scheduledAt: data.scheduledAt,
      status: ScheduledMessageStatus.PENDING,
      isRecurring: data.isRecurring || false,
      recurringPattern: data.recurringPattern || null,
      recurringConfig: data.recurringConfig || null,
      recurringEndDate: data.recurringEndDate || null,
    });
    return await this.scheduledMessageRepository.save(scheduledMessage);
  }

  async update(id: string, data: Partial<ScheduledMessage>): Promise<ScheduledMessage> {
    const message = await this.findOne(id);
    Object.assign(message, data);
    return await this.scheduledMessageRepository.save(message);
  }

  async delete(id: string): Promise<void> {
    const message = await this.findOne(id);
    await this.scheduledMessageRepository.remove(message);
  }

  async markAsSent(id: string): Promise<ScheduledMessage> {
    const message = await this.findOne(id);
    message.status = ScheduledMessageStatus.SENT;
    message.sentAt = new Date();
    message.sentCount += 1;

    // Если это повторяющееся сообщение, создаем следующее
    if (message.isRecurring && message.recurringPattern) {
      const nextScheduledAt = this.calculateNextScheduledDate(
        message.scheduledAt,
        message.recurringPattern,
        message.recurringConfig,
      );

      // Проверяем, не истекла ли дата окончания повторений
      if (!message.recurringEndDate || nextScheduledAt <= message.recurringEndDate) {
        // Создаем новое запланированное сообщение
        const nextMessage = this.scheduledMessageRepository.create({
          chatId: message.chatId,
          type: message.type,
          message: message.message,
          mediaUrl: message.mediaUrl,
          caption: message.caption,
          pollOptions: message.pollOptions,
          scheduledAt: nextScheduledAt,
          status: ScheduledMessageStatus.PENDING,
          isRecurring: true,
          recurringPattern: message.recurringPattern,
          recurringConfig: message.recurringConfig,
          recurringEndDate: message.recurringEndDate,
          sentCount: 0,
        });
        await this.scheduledMessageRepository.save(nextMessage);
      }
    }

    return await this.scheduledMessageRepository.save(message);
  }

  async markAsFailed(id: string, errorMessage: string): Promise<ScheduledMessage> {
    const message = await this.findOne(id);
    message.status = ScheduledMessageStatus.FAILED;
    message.errorMessage = errorMessage;
    return await this.scheduledMessageRepository.save(message);
  }

  async cancel(id: string): Promise<ScheduledMessage> {
    const message = await this.findOne(id);
    if (message.status === ScheduledMessageStatus.PENDING) {
      message.status = ScheduledMessageStatus.CANCELLED;
      return await this.scheduledMessageRepository.save(message);
    }
    return message;
  }

  private calculateNextScheduledDate(
    currentDate: Date,
    pattern: string,
    config?: Record<string, any>,
  ): Date {
    const nextDate = new Date(currentDate);

    switch (pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'custom':
        if (config?.days) {
          nextDate.setDate(nextDate.getDate() + config.days);
        } else if (config?.hours) {
          nextDate.setHours(nextDate.getHours() + config.hours);
        } else if (config?.minutes) {
          nextDate.setMinutes(nextDate.getMinutes() + config.minutes);
        }
        break;
      default:
        nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  // Cron job для проверки и отправки запланированных сообщений
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledMessages() {
    try {
      const pendingMessages = await this.findPending();
      
      if (pendingMessages.length === 0) {
        return;
      }

      this.logger.log(`Найдено ${pendingMessages.length} сообщений для отправки`);

      for (const message of pendingMessages) {
        try {
          await this.sendScheduledMessage(message);
          const updatedMessage = await this.markAsSent(message.id);
          this.logger.log(`Сообщение ${message.id} успешно отправлено`);
          // Отправляем событие через WebSocket для синхронизации
          this.webSocketGateway.emitScheduledMessageStatusChange(message.id, 'sent');
        } catch (error: any) {
          this.logger.error(`Ошибка при отправке сообщения ${message.id}: ${error.message}`);
          const failedMessage = await this.markAsFailed(message.id, error.message);
          // Отправляем событие через WebSocket для синхронизации
          this.webSocketGateway.emitScheduledMessageStatusChange(message.id, 'failed');
        }
      }
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке запланированных сообщений: ${error.message}`);
    }
  }

  private async sendScheduledMessage(message: ScheduledMessage): Promise<void> {
    const chatId = message.chatId;

    switch (message.type) {
      case ScheduledMessageType.TEXT:
        if (!message.message) {
          throw new Error('Текст сообщения не указан');
        }
        await this.telegramService.sendMessage(chatId, message.message, {
          parse_mode: 'HTML',
        });
        break;

      case ScheduledMessageType.PHOTO:
        if (!message.mediaUrl) {
          throw new Error('URL фото не указан');
        }
        await this.telegramService.sendPhoto(chatId, message.mediaUrl, {
          caption: message.caption || undefined,
          parse_mode: message.caption ? 'HTML' : undefined,
        });
        break;

      case ScheduledMessageType.VIDEO:
        if (!message.mediaUrl) {
          throw new Error('URL видео не указан');
        }
        await this.telegramService.sendVideo(chatId, message.mediaUrl, {
          caption: message.caption || undefined,
          parse_mode: message.caption ? 'HTML' : undefined,
        });
        break;

      case ScheduledMessageType.AUDIO:
        if (!message.mediaUrl) {
          throw new Error('URL аудио не указан');
        }
        await this.telegramService.sendAudio(chatId, message.mediaUrl, {
          caption: message.caption || undefined,
          parse_mode: message.caption ? 'HTML' : undefined,
        });
        break;

      case ScheduledMessageType.DOCUMENT:
        if (!message.mediaUrl) {
          throw new Error('URL документа не указан');
        }
        await this.telegramService.sendDocument(chatId, message.mediaUrl, {
          caption: message.caption || undefined,
          parse_mode: message.caption ? 'HTML' : undefined,
        });
        break;

      case ScheduledMessageType.STICKER:
        if (!message.mediaUrl) {
          throw new Error('File ID стикера не указан');
        }
        await this.telegramService.sendSticker(chatId, message.mediaUrl);
        break;

      case ScheduledMessageType.POLL:
        if (!message.message || !message.pollOptions || message.pollOptions.length < 2) {
          throw new Error('Вопрос опроса или варианты ответов не указаны');
        }
        await this.telegramService.sendPoll(chatId, message.message, message.pollOptions, {
          is_anonymous: false,
        });
        break;

      default:
        throw new Error(`Неподдерживаемый тип сообщения: ${message.type}`);
    }
  }
}

