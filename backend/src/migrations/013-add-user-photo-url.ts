import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPhotoUrl1701234567900 implements MigrationInterface {
  name = 'AddUserPhotoUrl1701234567900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        AND column_name = 'photoUrl'
      );
    `);

    if (!column[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "photoUrl" text;
      `);
      console.log('Колонка photoUrl успешно добавлена в таблицу users');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        AND column_name = 'photoUrl'
      );
    `);

    if (column[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        DROP COLUMN IF EXISTS "photoUrl";
      `);
      console.log('Колонка photoUrl успешно удалена из таблицы users');
    }
  }
}

