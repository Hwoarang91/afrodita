import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Service } from './service.entity';
import { Appointment } from './appointment.entity';
import { WorkSchedule } from './work-schedule.entity';
import { BlockInterval } from './block-interval.entity';

@Entity('masters')
@Index(['isActive'])
@Index(['name'])
export class Master {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'text', nullable: true })
  photoUrl: string;

  @Column({ type: 'text', nullable: true })
  education: string; // Образование мастера

  @Column({ type: 'int', default: 0 })
  experience: number; // лет опыта

  @Column({ type: 'jsonb', nullable: true })
  specialties: string[];

  @Column({ type: 'int', default: 15 })
  breakDuration: number; // перерыв между сеансами в минутах

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  totalAppointments: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => Service, (service) => service.masters)
  services: Service[];

  @OneToMany(() => Appointment, (appointment) => appointment.master)
  appointments: Appointment[];

  @OneToMany(() => WorkSchedule, (schedule) => schedule.master)
  workSchedules: WorkSchedule[];

  @OneToMany(() => BlockInterval, (block) => block.master)
  blockIntervals: BlockInterval[];
}

