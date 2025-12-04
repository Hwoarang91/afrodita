import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppointmentDiscount1701234567894 implements MigrationInterface {
  name = 'AddAppointmentDiscount1701234567894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments'
      );
    `);

    if (!table[0].exists) {
      console.log('Таблица appointments не существует, пропускаем миграцию');
      return;
    }

    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'discount'
      );
    `);

    if (column[0].exists) {
      console.log('Колонка discount уже существует, пропускаем миграцию');
      return;
    }

    // Добавляем колонку discount
    await queryRunner.query(`
      ALTER TABLE "appointments" 
      ADD COLUMN "discount" DECIMAL(10,2) NULL;
    `);

    console.log('Колонка discount успешно добавлена в таблицу appointments');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'discount'
      );
    `);

    if (!column[0].exists) {
      console.log('Колонка discount не существует, пропускаем откат');
      return;
    }

    // Удаляем колонку discount
    await queryRunner.query(`
      ALTER TABLE "appointments" 
      DROP COLUMN "discount";
    `);

    console.log('Колонка discount успешно удалена из таблицы appointments');
  }
}

