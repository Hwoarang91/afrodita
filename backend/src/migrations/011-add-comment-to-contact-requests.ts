import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentToContactRequests1701234567898 implements MigrationInterface {
  name = 'AddCommentToContactRequests1701234567898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_requests'
        AND column_name = 'comment'
      );
    `);

    if (column[0].exists) {
      console.log('Колонка comment уже существует, пропускаем миграцию');
      return;
    }

    // Добавляем колонку comment
    await queryRunner.query(`
      ALTER TABLE "contact_requests" 
      ADD COLUMN "comment" text;
    `);

    console.log('Колонка comment успешно добавлена в таблицу contact_requests');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_requests'
        AND column_name = 'comment'
      );
    `);

    if (!column[0].exists) {
      console.log('Колонка comment не существует, пропускаем откат');
      return;
    }

    // Удаляем колонку
    await queryRunner.query(`
      ALTER TABLE "contact_requests" 
      DROP COLUMN IF EXISTS "comment";
    `);

    console.log('Колонка comment успешно удалена из таблицы contact_requests');
  }
}

