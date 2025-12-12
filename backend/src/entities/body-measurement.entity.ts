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

@Entity('body_measurements')
@Index(['userId', 'measurementDate'])
export class BodyMeasurement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  measurementDate: Date; // Дата замера

  // Объемы тела (в сантиметрах)
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  neck: number; // Обхват шеи

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  chest: number; // Обхват груди

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  waist: number; // Обхват талии

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  hips: number; // Обхват бедер

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  thighLeft: number; // Обхват бедра левого

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  thighRight: number; // Обхват бедра правого

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  armLeft: number; // Обхват руки левой

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  armRight: number; // Обхват руки правой

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  calfLeft: number; // Обхват икры левой

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  calfRight: number; // Обхват икры правой

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  shoulder: number; // Ширина плеч

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  weight: number; // Вес на момент замера

  @Column({ type: 'text', nullable: true })
  notes: string; // Дополнительные заметки о замере

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

