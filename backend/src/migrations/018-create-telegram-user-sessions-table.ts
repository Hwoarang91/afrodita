import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTelegramUserSessionsTable1701234569001 implements MigrationInterface {
  name = 'CreateTelegramUserSessionsTable1701234569001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telegram_user_sessions'
      );
    `);

    if (table[0].exists) {
      console.log('Таблица telegram_user_sessions уже существует, пропускаем миграцию');
      return;
    }

    // Создаем таблицу telegram_user_sessions
    await queryRunner.query(`
      CREATE TABLE "telegram_user_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "phone_number" varchar(20),
        "api_id" integer NOT NULL,
        "api_hash" varchar(255) NOT NULL,
        "encrypted_session_data" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMP,
        "ip_address" varchar(255),
        "user_agent" varchar(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_telegram_user_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_telegram_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // Создаем индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_telegram_user_sessions_userId_isActive" ON "telegram_user_sessions" ("user_id", "is_active");
      CREATE INDEX "IDX_telegram_user_sessions_phoneNumber" ON "telegram_user_sessions" ("phone_number");
    `);

    console.log('Таблица telegram_user_sessions успешно создана');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telegram_user_sessions'
      );
    `);

    if (!table[0].exists) {
      console.log('Таблица telegram_user_sessions не существует, пропускаем откат');
      return;
    }

    // Удаляем индексы
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_phoneNumber";
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_userId_isActive";
    `);

    // Удаляем таблицу
    await queryRunner.query(`
      DROP TABLE IF EXISTS "telegram_user_sessions";
    `);

    console.log('Таблица telegram_user_sessions успешно удалена');
  }
}

