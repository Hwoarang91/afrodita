import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddServiceIsCategory1701234567892 implements MigrationInterface {
  name = 'AddServiceIsCategory1701234567892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы services
    const tableExists = await queryRunner.hasTable('services');
    if (!tableExists) {
      console.log('Таблица services не существует, пропускаем миграцию');
      return;
    }
    
    // Проверяем, существует ли колонка isCategory
    const table = await queryRunner.getTable('services');
    const isCategoryColumn = table?.findColumnByName('isCategory');
    
    // Добавляем колонку isCategory только если её нет
    if (!isCategoryColumn) {
      await queryRunner.addColumn(
        'services',
        new TableColumn({
          name: 'isCategory',
          type: 'boolean',
          default: false,
        }),
      );
    }

    // Проверяем, существует ли индекс
    const indexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'IDX_services_isCategory'
      )
    `);

    // Создаем индекс для isCategory только если его нет
    if (!indexExists[0].exists) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_services_isCategory" ON "services" ("isCategory")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индекс
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_services_isCategory"
    `);

    // Удаляем колонку
    await queryRunner.dropColumn('services', 'isCategory');
  }
}

