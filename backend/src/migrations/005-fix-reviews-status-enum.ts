import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixReviewsStatusEnum1701234567893 implements MigrationInterface {
  name = 'FixReviewsStatusEnum1701234567893';
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
      // Таблица не существует, просто создаем enum
      await queryRunner.query(`
        CREATE TYPE reviews_status_enum AS ENUM ('pending', 'approved', 'rejected')
      `);
      return;
    }

    // Таблица существует, нужно обновить enum
    // Сначала временно изменяем колонку на text (чтобы можно было обновить значения)
    await queryRunner.query(`
      ALTER TABLE reviews 
      ALTER COLUMN status TYPE text USING status::text
    `);

    // Теперь обновляем существующие значения в таблице на lowercase
    // Используем LOWER() для всех значений, чтобы гарантировать lowercase
    await queryRunner.query(`
      UPDATE reviews 
      SET status = LOWER(status)
      WHERE status IS NOT NULL
    `);

    // Удаляем старый enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS reviews_status_enum CASCADE
    `);

    // Создаем новый enum с правильными значениями (lowercase)
    await queryRunner.query(`
      CREATE TYPE reviews_status_enum AS ENUM ('pending', 'approved', 'rejected')
    `);

    // Возвращаем колонку к типу enum
    await queryRunner.query(`
      ALTER TABLE reviews 
      ALTER COLUMN status TYPE reviews_status_enum 
      USING status::reviews_status_enum
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // При откате возвращаем uppercase значения
    await queryRunner.query(`
      UPDATE reviews 
      SET status = CASE 
        WHEN status::text = 'pending' THEN 'PENDING'::text
        WHEN status::text = 'approved' THEN 'APPROVED'::text
        WHEN status::text = 'rejected' THEN 'REJECTED'::text
        ELSE status::text
      END
      WHERE status::text IN ('pending', 'approved', 'rejected')
    `);

    await queryRunner.query(`
      ALTER TABLE reviews 
      ALTER COLUMN status TYPE text
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS reviews_status_enum CASCADE
    `);

    await queryRunner.query(`
      CREATE TYPE reviews_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      ALTER TABLE reviews 
      ALTER COLUMN status TYPE reviews_status_enum 
      USING status::reviews_status_enum
    `);
  }
}

