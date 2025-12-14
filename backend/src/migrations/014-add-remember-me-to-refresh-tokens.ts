import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRememberMeToRefreshTokens1701234568000 implements MigrationInterface {
  name = 'AddRememberMeToRefreshTokens1701234568000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'rememberMe'
      );
    `);

    if (!column[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        ADD COLUMN "rememberMe" boolean NOT NULL DEFAULT false;
      `);
      console.log('Колонка rememberMe успешно добавлена в таблицу refresh_tokens');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки
    const column = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'rememberMe'
      );
    `);

    if (column[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        DROP COLUMN IF EXISTS "rememberMe";
      `);
      console.log('Колонка rememberMe успешно удалена из таблицы refresh_tokens');
    }
  }
}

