import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('telegram_user_sessions')
@Index(['userId', 'isActive'])
@Index(['phoneNumber'])
export class TelegramUserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  phoneNumber: string | null;

  @Column({ type: 'int', name: 'api_id' })
  apiId: number;

  @Column({ type: 'varchar', length: 255, name: 'api_hash' })
  apiHash: string;

  @Column({ type: 'text', name: 'encrypted_session_data' })
  encryptedSessionData: string; // Зашифрованные данные сессии MTProto

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'initializing',
    name: 'status',
    comment: 'Статус сессии: active, invalid, revoked, initializing',
  })
  status: 'active' | 'invalid' | 'revoked' | 'initializing';

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'invalid_reason' })
  invalidReason: string | null;

  @Column({ type: 'int', nullable: true, name: 'dc_id' })
  dcId: number | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

