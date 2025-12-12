import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixReviewsStatusData1701234567894 implements MigrationInterface {
  name = 'FixReviewsStatusData1701234567894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли таблица reviews
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'reviews'
      )
    `);

    if (!tableExists[0].exists) {
      return; // Таблица не существует, пропускаем миграцию
    }

    // Проверяем, есть ли записи с неправильными значениями
    const hasUppercase = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM reviews
      WHERE status::text IN ('PENDING', 'APPROVED', 'REJECTED')
    `);

    if (hasUppercase[0].count === '0') {
      return; // Нет записей с неправильными значениями, пропускаем
    }

    // Временно изменяем тип колонки на text
    await queryRunner.query(`
      ALTER TABLE reviews
      ALTER COLUMN status TYPE text USING status::text
    `);

    // Обновляем все значения на lowercase
    await queryRunner.query(`
      UPDATE reviews
      SET status = LOWER(status)
      WHERE status IS NOT NULL
    `);

    // Возвращаем тип колонки обратно на enum
    await queryRunner.query(`
      ALTER TABLE reviews
      ALTER COLUMN status TYPE reviews_status_enum USING status::reviews_status_enum
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Откат не требуется, так как это исправление данных
  }
}

