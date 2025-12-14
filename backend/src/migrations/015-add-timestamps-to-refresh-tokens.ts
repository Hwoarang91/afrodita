import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimestampsToRefreshTokens1701234569000 implements MigrationInterface {
  name = 'AddTimestampsToRefreshTokens1701234569000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки createdAt
    const createdAtColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'createdAt'
      );
    `);

    if (!createdAtColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('Колонка createdAt успешно добавлена в таблицу refresh_tokens');
    }

    // Проверяем существование колонки updatedAt
    const updatedAtColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'updatedAt'
      );
    `);

    if (!updatedAtColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('Колонка updatedAt успешно добавлена в таблицу refresh_tokens');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки createdAt
    const createdAtColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'createdAt'
      );
    `);

    if (createdAtColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        DROP COLUMN IF EXISTS "createdAt";
      `);
      console.log('Колонка createdAt успешно удалена из таблицы refresh_tokens');
    }

    // Проверяем существование колонки updatedAt
    const updatedAtColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        AND column_name = 'updatedAt'
      );
    `);

    if (updatedAtColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        DROP COLUMN IF EXISTS "updatedAt";
      `);
      console.log('Колонка updatedAt успешно удалена из таблицы refresh_tokens');
    }
  }
}

