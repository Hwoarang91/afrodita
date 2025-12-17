import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ScheduledMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ScheduledMessageType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  POLL = 'poll',
}

@Entity('scheduled_messages')
@Index(['scheduledAt', 'status'])
@Index(['chatId', 'status'])
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', name: 'chat_id' })
  chatId: string; // ID чата или группы в Telegram

  @Column({ type: 'varchar', length: 50 })
  type: ScheduledMessageType; // Тип сообщения

  @Column({ type: 'text', nullable: true })
  message: string | null; // Текст сообщения

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'media_url' })
  mediaUrl: string | null; // URL или file_id медиа

  @Column({ type: 'text', nullable: true })
  caption: string | null; // Подпись к медиа

  @Column({ type: 'jsonb', nullable: true, name: 'poll_options' })
  pollOptions: string[] | null; // Варианты ответов для опроса

  @Column({ type: 'timestamp', name: 'scheduled_at' })
  scheduledAt: Date; // Время отправки

  @Column({ type: 'varchar', length: 50, default: ScheduledMessageStatus.PENDING })
  status: ScheduledMessageStatus; // Статус сообщения

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null; // Сообщение об ошибке (если отправка не удалась)

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt: Date | null; // Время фактической отправки

  @Column({ type: 'boolean', default: false, name: 'is_recurring' })
  isRecurring: boolean; // Повторяющееся сообщение

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'recurring_pattern' })
  recurringPattern: string | null; // Паттерн повторения (daily, weekly, monthly, custom)

  @Column({ type: 'jsonb', nullable: true, name: 'recurring_config' })
  recurringConfig: Record<string, any> | null; // Конфигурация повторения

  @Column({ type: 'timestamp', nullable: true, name: 'recurring_end_date' })
  recurringEndDate: Date | null; // Дата окончания повторений

  @Column({ type: 'integer', default: 0, name: 'sent_count' })
  sentCount: number; // Количество отправок (для повторяющихся сообщений)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

