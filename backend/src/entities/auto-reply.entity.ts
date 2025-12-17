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

  @Column({ type: 'varchar', length: 50, default: 'exact', name: 'match_type' })
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex'; // Тип совпадения

  @Column({ type: 'boolean', default: true, name: 'case_sensitive' })
  caseSensitive: boolean; // Учитывать регистр

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean; // Активно ли правило

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'chat_type' })
  chatType: 'all' | 'private' | 'group' | 'supergroup' | 'channel' | null; // Тип чата, где применяется правило

  @Column({ type: 'bigint', nullable: true, name: 'chat_id' })
  chatId: string | null; // Конкретный чат, где применяется правило (null = все чаты)

  @Column({ type: 'integer', default: 0, name: 'usage_count' })
  usageCount: number; // Счетчик использования

  @Column({ type: 'timestamp', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null; // Время последнего использования

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

