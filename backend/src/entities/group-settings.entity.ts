import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TelegramChat } from './telegram-chat.entity';

@Entity('group_settings')
@Index(['chatId'], { unique: true })
export class GroupSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  chatId: string; // Telegram chat ID группы

  @ManyToOne(() => TelegramChat, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId', referencedColumnName: 'chatId' })
  chat: TelegramChat;

  @Column({ type: 'varchar', default: 'ru' })
  language: string; // Язык группы (ru, en, etc.)

  @Column({ type: 'jsonb', default: {} })
  enabledCommands: {
    schedule?: boolean; // Включена ли команда /schedule
    masters?: boolean; // Включена ли команда /masters
    promotions?: boolean; // Включена ли команда /promotions
    faq?: boolean; // Включена ли команда /faq
  };

  @Column({ type: 'jsonb', default: {} })
  notifications: {
    welcomeEnabled?: boolean; // Включены ли приветственные сообщения
    newMemberEnabled?: boolean; // Включены ли уведомления о новых участниках
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

