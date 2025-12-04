import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupSettings1701234567896 implements MigrationInterface {
  name = 'CreateGroupSettings1701234567896';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'group_settings'
      );
    `);

    if (table[0].exists) {
      console.log('Таблица group_settings уже существует, пропускаем миграцию');
      return;
    }

    // Создаем таблицу group_settings
    await queryRunner.query(`
      CREATE TABLE "group_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "chatId" bigint NOT NULL,
        "language" varchar NOT NULL DEFAULT 'ru',
        "enabledCommands" jsonb NOT NULL DEFAULT '{}',
        "notifications" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_settings_chatId" UNIQUE ("chatId")
      );
    `);

    // Создаем индекс для chatId
    await queryRunner.query(`
      CREATE INDEX "IDX_group_settings_chatId" ON "group_settings" ("chatId");
    `);

    console.log('Таблица group_settings успешно создана');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'group_settings'
      );
    `);

    if (!table[0].exists) {
      console.log('Таблица group_settings не существует, пропускаем откат');
      return;
    }

    // Удаляем индекс
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_group_settings_chatId";
    `);

    // Удаляем таблицу
    await queryRunner.query(`
      DROP TABLE IF EXISTS "group_settings";
    `);

    console.log('Таблица group_settings успешно удалена');
  }
}

