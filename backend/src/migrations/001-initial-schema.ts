import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Эта миграция не выполняет никаких действий
    // Используется только для создания таблицы migrations
    // Реальные миграции создаются через TypeORM CLI
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Откат не требуется
  }
}

