import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
  ManyToOne,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { Master } from './master.entity';

@Entity('services')
@Index(['isActive'])
@Index(['category'])
@Index(['name'])
@Index(['parentServiceId'])
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  duration: number; // в минутах

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', nullable: true })
  category: string;

  @Column({ type: 'uuid', nullable: true })
  parentServiceId: string | null; // ID родительской услуги (для подкатегорий)

  @ManyToOne(() => Service, (service) => service.subcategories, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentServiceId' })
  parentService: Service | null;

  @OneToMany(() => Service, (service) => service.parentService, { cascade: false })
  subcategories: Service[]; // Подкатегории этой услуги

  @Column({ type: 'boolean', default: false })
  isCategory: boolean; // Флаг категории (без цены и времени, только название)

  @Column({ type: 'boolean', default: false })
  allowMultipleSubcategories: boolean; // Разрешить выбор нескольких подкатегорий (только для категорий)

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  bonusPointsPercent: number; // процент бонусов от стоимости

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => Master, (master) => master.services)
  @JoinTable({
    name: 'master_services',
    joinColumn: { name: 'serviceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'masterId', referencedColumnName: 'id' },
  })
  masters: Master[];
}

