import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramUserSessionsIndexes1705000000000 implements MigrationInterface {
  name = 'AddTelegramUserSessionsIndexes1705000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы telegram_user_sessions
    const tableExists = await queryRunner.hasTable('telegram_user_sessions');
    
    if (!tableExists) {
      console.log('Таблица telegram_user_sessions не существует, пропускаем миграцию');
      return;
    }

    // Добавляем композитный индекс для поиска активных сессий по userId, isActive, status
    const index1Exists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'telegram_user_sessions' 
      AND indexname = 'IDX_telegram_user_sessions_userId_isActive_status';
    `);

    if (index1Exists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "IDX_telegram_user_sessions_userId_isActive_status" 
        ON "telegram_user_sessions" ("user_id", "is_active", "status");
      `);
      console.log('Индекс IDX_telegram_user_sessions_userId_isActive_status создан');
    } else {
      console.log('Индекс IDX_telegram_user_sessions_userId_isActive_status уже существует, пропускаем');
    }

    // Добавляем композитный индекс для поиска по status и isActive (для административных запросов)
    const index2Exists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'telegram_user_sessions' 
      AND indexname = 'IDX_telegram_user_sessions_status_isActive';
    `);

    if (index2Exists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "IDX_telegram_user_sessions_status_isActive" 
        ON "telegram_user_sessions" ("status", "is_active");
      `);
      console.log('Индекс IDX_telegram_user_sessions_status_isActive создан');
    } else {
      console.log('Индекс IDX_telegram_user_sessions_status_isActive уже существует, пропускаем');
    }

    // Добавляем индекс на createdAt для ORDER BY запросов
    const index3Exists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'telegram_user_sessions' 
      AND indexname = 'IDX_telegram_user_sessions_createdAt';
    `);

    if (index3Exists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "IDX_telegram_user_sessions_createdAt" 
        ON "telegram_user_sessions" ("created_at");
      `);
      console.log('Индекс IDX_telegram_user_sessions_createdAt создан');
    } else {
      console.log('Индекс IDX_telegram_user_sessions_createdAt уже существует, пропускаем');
    }

    // Добавляем индекс на lastUsedAt для ORDER BY запросов
    const index4Exists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'telegram_user_sessions' 
      AND indexname = 'IDX_telegram_user_sessions_lastUsedAt';
    `);

    if (index4Exists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "IDX_telegram_user_sessions_lastUsedAt" 
        ON "telegram_user_sessions" ("last_used_at");
      `);
      console.log('Индекс IDX_telegram_user_sessions_lastUsedAt создан');
    } else {
      console.log('Индекс IDX_telegram_user_sessions_lastUsedAt уже существует, пропускаем');
    }

    // Добавляем композитный индекс для ORDER BY по lastUsedAt и createdAt (для getUserSessions)
    const index5Exists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'telegram_user_sessions' 
      AND indexname = 'IDX_telegram_user_sessions_lastUsedAt_createdAt';
    `);

    if (index5Exists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "IDX_telegram_user_sessions_lastUsedAt_createdAt" 
        ON "telegram_user_sessions" ("last_used_at" DESC, "created_at" DESC);
      `);
      console.log('Индекс IDX_telegram_user_sessions_lastUsedAt_createdAt создан');
    } else {
      console.log('Индекс IDX_telegram_user_sessions_lastUsedAt_createdAt уже существует, пропускаем');
    }

    console.log('Все индексы для telegram_user_sessions успешно добавлены');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы telegram_user_sessions
    const tableExists = await queryRunner.hasTable('telegram_user_sessions');
    
    if (!tableExists) {
      console.log('Таблица telegram_user_sessions не существует, пропускаем откат миграции');
      return;
    }

    // Удаляем все добавленные индексы
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_lastUsedAt_createdAt";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_lastUsedAt";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_createdAt";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_status_isActive";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_user_sessions_userId_isActive_status";
    `);

    console.log('Все индексы для telegram_user_sessions успешно удалены');
  }
}
