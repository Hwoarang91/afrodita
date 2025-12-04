import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAuditLogsEntityId1701234567890 implements MigrationInterface {
  name = 'FixAuditLogsEntityId1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Изменяем тип колонки entityId с uuid на varchar
    // Сначала удаляем данные, которые не являются валидными UUID (если есть)
    await queryRunner.query(`
      DELETE FROM audit_logs 
      WHERE "entityId" IS NOT NULL 
      AND "entityId"::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);
    
    // Изменяем тип колонки
    await queryRunner.query(`
      ALTER TABLE audit_logs 
      ALTER COLUMN "entityId" TYPE VARCHAR USING "entityId"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Возвращаем тип обратно на uuid
    // Удаляем записи, которые не являются валидными UUID
    await queryRunner.query(`
      DELETE FROM audit_logs 
      WHERE "entityId" IS NOT NULL 
      AND "entityId"::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);
    
    await queryRunner.query(`
      ALTER TABLE audit_logs 
      ALTER COLUMN "entityId" TYPE UUID USING "entityId"::uuid
    `);
  }
}

