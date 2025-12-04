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
import { Appointment } from './appointment.entity';
import { Master } from './master.entity';
import { Service } from './service.entity';

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('reviews')
@Index(['appointmentId'])
@Index(['masterId', 'status'])
@Index(['serviceId', 'status'])
@Index(['status'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment)
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  masterId: string;

  @ManyToOne(() => Master)
  @JoinColumn({ name: 'masterId' })
  master: Master;

  @Column({ type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column({ type: 'int' })
  rating: number; // Рейтинг от 1 до 5

  @Column({ type: 'text', nullable: true })
  comment: string; // Текст отзыва

  @Column({
    type: 'enum',
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
  })
  status: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  moderationComment: string; // Комментарий модератора при отклонении

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

