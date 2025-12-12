import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddWeightAndBodyMeasurements1701234567899 implements MigrationInterface {
  name = 'AddWeightAndBodyMeasurements1701234567899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле weight в таблицу users
    const weightColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        AND column_name = 'weight'
      );
    `);

    if (!weightColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "weight" DECIMAL(5,2);
      `);
      console.log('Колонка weight успешно добавлена в таблицу users');
    }

    // Создаем таблицу body_measurements
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'body_measurements'
      );
    `);

    if (!tableExists[0].exists) {
      await queryRunner.createTable(
        new Table({
          name: 'body_measurements',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'userId',
              type: 'uuid',
            },
            {
              name: 'measurementDate',
              type: 'date',
            },
            {
              name: 'neck',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'chest',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'waist',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'hips',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'thighLeft',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'thighRight',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'armLeft',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'armRight',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'calfLeft',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'calfRight',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'shoulder',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'weight',
              type: 'decimal',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'notes',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      // Создаем индекс
      await queryRunner.query(`
        CREATE INDEX "IDX_body_measurements_userId_measurementDate" 
        ON "body_measurements" ("userId", "measurementDate");
      `);

      // Создаем внешний ключ
      await queryRunner.createForeignKey(
        'body_measurements',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );

      console.log('Таблица body_measurements успешно создана');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем таблицу body_measurements
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'body_measurements'
      );
    `);

    if (tableExists[0].exists) {
      await queryRunner.dropTable('body_measurements');
      console.log('Таблица body_measurements успешно удалена');
    }

    // Удаляем поле weight из таблицы users
    const weightColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        AND column_name = 'weight'
      );
    `);

    if (weightColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        DROP COLUMN IF EXISTS "weight";
      `);
      console.log('Колонка weight успешно удалена из таблицы users');
    }
  }
}

