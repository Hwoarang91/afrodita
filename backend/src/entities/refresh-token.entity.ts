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

@Entity('refresh_tokens')
  @Index(['userId', 'expiresAt'])
  @Index(['tokenHash'])
  // Note: TypeORM will use the column names specified in @Column decorators for indexes
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'varchar', length: 255, name: 'token_family' })
  tokenFamily: string; // Для rotation - все tokens в семье инвалидируются при компрометации

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_compromised' })
  isCompromised: boolean; // Если токен был скомпрометирован

  @Column({ type: 'boolean', default: false, name: 'remember_me' })
  rememberMe: boolean; // Флаг "Запомнить меня" - влияет на срок жизни токена

  @Column({ type: 'timestamp', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
