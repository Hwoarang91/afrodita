import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddServiceSubcategories1701234567891 implements MigrationInterface {
  name = 'AddServiceSubcategories1701234567891';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли колонка parentServiceId
    const table = await queryRunner.getTable('services');
    const parentServiceIdColumn = table?.findColumnByName('parentServiceId');
    
    // Добавляем колонку parentServiceId только если её нет
    if (!parentServiceIdColumn) {
      await queryRunner.addColumn(
        'services',
        new TableColumn({
          name: 'parentServiceId',
          type: 'uuid',
        isNullable: true,
      }),
      );
    }

    // Проверяем, существует ли колонка allowMultipleSubcategories
    const allowMultipleColumn = table?.findColumnByName('allowMultipleSubcategories');
    
    // Добавляем колонку allowMultipleSubcategories только если её нет
    if (!allowMultipleColumn) {
      await queryRunner.addColumn(
        'services',
        new TableColumn({
          name: 'allowMultipleSubcategories',
          type: 'boolean',
          default: false,
        }),
      );
    }

    // Обновляем информацию о таблице после добавления колонок
    const updatedTable = await queryRunner.getTable('services');
    const finalParentServiceIdColumn = updatedTable?.findColumnByName('parentServiceId');

    // Проверяем, существует ли индекс
    const indexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'IDX_services_parentServiceId'
      )
    `);

    // Создаем индекс для parentServiceId только если его нет и колонка существует
    if (!indexExists[0].exists && finalParentServiceIdColumn) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_services_parentServiceId" ON "services" ("parentServiceId")
      `);
    }

    // Проверяем, существует ли внешний ключ
    const foreignKeyExists = updatedTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('parentServiceId') !== -1,
    );

    // Создаем внешний ключ для parentServiceId только если его нет и колонка существует
    if (!foreignKeyExists && finalParentServiceIdColumn) {
      await queryRunner.createForeignKey(
        'services',
        new TableForeignKey({
          columnNames: ['parentServiceId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'services',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    const table = await queryRunner.getTable('services');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('parentServiceId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('services', foreignKey);
    }

    // Удаляем индекс
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_services_parentServiceId"
    `);

    // Удаляем колонки
    await queryRunner.dropColumn('services', 'allowMultipleSubcategories');
    await queryRunner.dropColumn('services', 'parentServiceId');
  }
}

