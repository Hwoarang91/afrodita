import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Transaction } from './transaction.entity';
import { Notification } from './notification.entity';

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin',
  MASTER = 'master',
}

@Entity('users')
@Index(['role', 'isActive'])
@Index(['firstName', 'lastName'])
@Index(['phone'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, nullable: true })
  @Index()
  telegramId!: string;

  @Column({ nullable: true })
  firstName!: string;

  @Column({ nullable: true })
  lastName!: string;

  @Column({ nullable: true })
  username!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true, unique: true })
  @Index()
  email!: string;

  @Column({ nullable: true })
  password!: string; // Хешированный пароль для админов

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role!: UserRole;

  @Column({ type: 'int', default: 0 })
  bonusPoints!: number;

  @Column({ unique: true, nullable: true })
  @Index()
  referralCode!: string; // Уникальный реферальный код пользователя

  @Column({ nullable: true })
  @Index()
  referredByUserId!: string; // ID пользователя, который пригласил этого пользователя

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  preferences!: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  adminNotes!: string; // Комментарий админа (виден только админам)

  @Column({ type: 'date', nullable: true })
  dateOfBirth!: Date; // Дата рождения для напоминаний

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight!: number; // Вес клиента в килограммах

  @Column({ type: 'text', nullable: true })
  photoUrl!: string; // URL фото клиента

  @Column({ type: 'jsonb', nullable: true })
  tags!: string[]; // Ручные метки и категории для клиента

  @Column({ type: 'varchar', nullable: true })
  segment!: string; // Автоматическая сегментация: VIP, постоянный, новый, неактивный

  @Column({ type: 'jsonb', nullable: true })
  notificationSettings!: {
    remindersEnabled?: boolean; // Включены ли напоминания
    reminderIntervals?: number[]; // Настраиваемые интервалы напоминаний в часах (например, [24, 2])
    birthdayRemindersEnabled?: boolean; // Включены ли напоминания о днях рождения
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Appointment, (appointment) => appointment.client)
  appointments!: Appointment[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Transaction[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications!: Notification[];
}

