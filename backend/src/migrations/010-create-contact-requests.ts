import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactRequests1701234567897 implements MigrationInterface {
  name = 'CreateContactRequests1701234567897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_requests'
      );
    `);

    if (table[0].exists) {
      console.log('Таблица contact_requests уже существует, пропускаем миграцию');
      return;
    }

    // Создаем таблицу contact_requests
    await queryRunner.query(`
      CREATE TABLE "contact_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "phone" varchar(50) NOT NULL,
        "message" text,
        "isRead" boolean NOT NULL DEFAULT false,
        "isProcessed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_requests" PRIMARY KEY ("id")
      );
    `);

    // Создаем индексы для оптимизации запросов
    await queryRunner.query(`
      CREATE INDEX "IDX_contact_requests_createdAt" ON "contact_requests" ("createdAt" DESC);
      CREATE INDEX "IDX_contact_requests_isRead" ON "contact_requests" ("isRead");
      CREATE INDEX "IDX_contact_requests_isProcessed" ON "contact_requests" ("isProcessed");
    `);

    console.log('Таблица contact_requests успешно создана');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы
    const table = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_requests'
      );
    `);

    if (!table[0].exists) {
      console.log('Таблица contact_requests не существует, пропускаем откат');
      return;
    }

    // Удаляем индексы
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_contact_requests_createdAt";
      DROP INDEX IF EXISTS "IDX_contact_requests_isRead";
      DROP INDEX IF EXISTS "IDX_contact_requests_isProcessed";
    `);

    // Удаляем таблицу
    await queryRunner.query(`
      DROP TABLE IF EXISTS "contact_requests";
    `);

    console.log('Таблица contact_requests успешно удалена');
  }
}

