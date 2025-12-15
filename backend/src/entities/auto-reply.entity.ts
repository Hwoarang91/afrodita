import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('auto_replies')
@Index(['keyword', 'isActive'])
export class AutoReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  keyword: string; // Ключевое слово или фраза для поиска

  @Column({ type: 'text' })
  response: string; // Ответ бота

  @Column({ type: 'varchar', length: 50, default: 'exact' })
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex'; // Тип совпадения

  @Column({ type: 'boolean', default: true })
  caseSensitive: boolean; // Учитывать регистр

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Активно ли правило

  @Column({ type: 'varchar', length: 50, nullable: true })
  chatType: 'all' | 'private' | 'group' | 'supergroup' | 'channel' | null; // Тип чата, где применяется правило

  @Column({ type: 'bigint', nullable: true })
  chatId: string | null; // Конкретный чат, где применяется правило (null = все чаты)

  @Column({ type: 'integer', default: 0 })
  usageCount: number; // Счетчик использования

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null; // Время последнего использования

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

