import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralSystemFields1706000000000 implements MigrationInterface {
  name = 'AddReferralSystemFields1706000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы users
    const tableExists = await queryRunner.hasTable('users');
    
    if (!tableExists) {
      return;
    }

    // Проверяем существование колонки referral_code
    const referralCodeExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'referral_code';
    `);

    if (referralCodeExists.length === 0) {
      // Добавляем колонку referral_code
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "referral_code" VARCHAR NULL UNIQUE;
      `);

      // Добавляем индекс для referral_code
      await queryRunner.query(`
        CREATE INDEX "IDX_users_referral_code" ON "users" ("referral_code");
      `);
    }

    // Проверяем существование колонки referred_by_user_id
    const referredByUserIdExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'referred_by_user_id';
    `);

    if (referredByUserIdExists.length === 0) {
      // Добавляем колонку referred_by_user_id
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "referred_by_user_id" UUID NULL;
      `);

      // Добавляем индекс для referred_by_user_id
      await queryRunner.query(`
        CREATE INDEX "IDX_users_referred_by_user_id" ON "users" ("referred_by_user_id");
      `);

      // Добавляем внешний ключ для referred_by_user_id (опционально, может быть null)
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD CONSTRAINT "FK_users_referred_by_user_id" 
        FOREIGN KEY ("referred_by_user_id") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE NO ACTION;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы users
    const tableExists = await queryRunner.hasTable('users');
    
    if (!tableExists) {
      return;
    }

    // Удаляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP CONSTRAINT IF EXISTS "FK_users_referred_by_user_id";
    `);

    // Удаляем индекс для referred_by_user_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_referred_by_user_id";
    `);

    // Удаляем колонку referred_by_user_id
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "referred_by_user_id";
    `);

    // Удаляем индекс для referral_code
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_referral_code";
    `);

    // Удаляем колонку referral_code
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "referral_code";
    `);
  }
}
