import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAuditLogsEntityId1701234567890 implements MigrationInterface {
  name = 'FixAuditLogsEntityId1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы audit_logs
    const tableExists = await queryRunner.hasTable('audit_logs');
    
    if (!tableExists) {
      console.log('Таблица audit_logs не существует, пропускаем миграцию');
      return;
    }
    
    // Проверяем существование колонки entityId
    const table = await queryRunner.getTable('audit_logs');
    const columnExists = table?.findColumnByName('entityId');
    
    if (!columnExists) {
      console.log('Колонка entityId не существует в таблице audit_logs, пропускаем миграцию');
      return;
    }
    
    // Изменяем тип колонки entityId с uuid на varchar
    // Сначала удаляем данные, которые не являются валидными UUID (если есть)
    try {
      await queryRunner.query(`
        DELETE FROM audit_logs 
        WHERE "entityId" IS NOT NULL 
        AND "entityId"::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);
    } catch (error: any) {
      console.log('Ошибка при удалении данных из audit_logs (возможно, таблица пустая):', error.message);
    }
    
    // Изменяем тип колонки
    await queryRunner.query(`
      ALTER TABLE audit_logs 
      ALTER COLUMN "entityId" TYPE VARCHAR USING "entityId"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы audit_logs
    const tableExists = await queryRunner.hasTable('audit_logs');
    
    if (!tableExists) {
      console.log('Таблица audit_logs не существует, пропускаем откат миграции');
      return;
    }
    
    // Проверяем существование колонки entityId
    const table = await queryRunner.getTable('audit_logs');
    const columnExists = table?.findColumnByName('entityId');
    
    if (!columnExists) {
      console.log('Колонка entityId не существует в таблице audit_logs, пропускаем откат миграции');
      return;
    }
    
    // Возвращаем тип обратно на uuid
    // Удаляем записи, которые не являются валидными UUID
    try {
      await queryRunner.query(`
        DELETE FROM audit_logs 
        WHERE "entityId" IS NOT NULL 
        AND "entityId"::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);
    } catch (error: any) {
      console.log('Ошибка при удалении данных из audit_logs (возможно, таблица пустая):', error.message);
    }
    
    await queryRunner.query(`
      ALTER TABLE audit_logs 
      ALTER COLUMN "entityId" TYPE UUID USING "entityId"::uuid
    `);
  }
}

