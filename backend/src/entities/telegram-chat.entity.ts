import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ChatType {
  PRIVATE = 'private',
  GROUP = 'group',
  SUPERGROUP = 'supergroup',
  CHANNEL = 'channel',
}

@Entity('telegram_chats')
@Index(['chatId'], { unique: true })
@Index(['type'])
@Index(['isActive'])
export class TelegramChat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  chatId: string; // Telegram chat ID (может быть отрицательным для групп)

  @Column({
    type: 'enum',
    enum: ChatType,
  })
  type: ChatType;

  @Column({ nullable: true })
  title: string; // Название группы/чата

  @Column({ nullable: true })
  username: string; // @username для групп/каналов

  @Column({ nullable: true })
  description: string; // Описание группы

  @Column({ nullable: true })
  photoUrl: string; // URL фото группы

  @Column({ type: 'int', default: 0, nullable: true })
  membersCount: number; // Количество участников (для групп)

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Активен ли бот в этом чате

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Дополнительная информация о чате

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

