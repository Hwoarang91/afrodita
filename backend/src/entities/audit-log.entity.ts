import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditAction {
  // Пользователи
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  
  // Мастера
  MASTER_CREATED = 'master_created',
  MASTER_UPDATED = 'master_updated',
  MASTER_DELETED = 'master_deleted',
  
  // Услуги
  SERVICE_CREATED = 'service_created',
  SERVICE_UPDATED = 'service_updated',
  SERVICE_DELETED = 'service_deleted',
  
  // Записи
  APPOINTMENT_CREATED = 'appointment_created',
  APPOINTMENT_UPDATED = 'appointment_updated',
  APPOINTMENT_DELETED = 'appointment_deleted',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  
  // Настройки
  SETTINGS_UPDATED = 'settings_updated',
  
  // Рассылки
  BROADCAST_SENT = 'broadcast_sent',
  NOTIFICATION_DELETED = 'notification_deleted',
  
  // Расписание мастеров
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_UPDATED = 'schedule_updated',
  SCHEDULE_DELETED = 'schedule_deleted',
  BLOCK_INTERVAL_CREATED = 'block_interval_created',
  BLOCK_INTERVAL_DELETED = 'block_interval_deleted',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', nullable: true })
  entityType: string; // 'user', 'master', 'service', 'appointment', etc.

  @Column({ type: 'varchar', nullable: true })
  entityId: string; // ID сущности, над которой было выполнено действие (может быть UUID или строка для настроек)

  @Column({ type: 'text', nullable: true })
  description: string; // Описание действия

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>; // Изменения (старое значение -> новое значение)

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}

