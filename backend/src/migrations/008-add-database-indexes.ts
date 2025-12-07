import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDatabaseIndexes1701234567895 implements MigrationInterface {
  name = 'AddDatabaseIndexes1701234567895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Индексы для таблицы appointments
    const appointmentsExists = await queryRunner.hasTable('appointments');
    if (appointmentsExists) {
      // Индекс для быстрого поиска записей по клиенту и статусу
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_appointments_client_status" 
        ON "appointments" ("clientId", "status");
      `);

      // Индекс для быстрого поиска записей по мастеру и дате
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_appointments_master_date" 
        ON "appointments" ("masterId", "startTime");
      `);

      // Индекс для быстрого поиска записей по статусу
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_appointments_status" 
        ON "appointments" ("status");
      `);

      // Индекс для быстрого поиска записей по дате начала
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_appointments_start_time" 
        ON "appointments" ("startTime");
      `);
    }

    // Индексы для таблицы services
    const servicesExists = await queryRunner.hasTable('services');
    if (servicesExists) {
      // Индекс для быстрого поиска родительской услуги
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_services_parent" 
        ON "services" ("parentServiceId") 
        WHERE "parentServiceId" IS NOT NULL;
      `);

      // Индекс для поиска категорий
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_services_is_category" 
        ON "services" ("isCategory");
      `);

      // Индекс для активных услуг
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_services_is_active" 
        ON "services" ("isActive");
      `);
    }

    // Индексы для таблицы users
    const usersExists = await queryRunner.hasTable('users');
    if (usersExists) {
      // Индекс для поиска по Telegram ID
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_users_telegram_id" 
        ON "users" ("telegramId") 
        WHERE "telegramId" IS NOT NULL;
      `);

      // Индекс для поиска по email
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_users_email" 
        ON "users" ("email") 
        WHERE "email" IS NOT NULL;
      `);

      // Индекс для поиска по телефону
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_users_phone" 
        ON "users" ("phone") 
        WHERE "phone" IS NOT NULL;
      `);

      // Индекс для поиска по роли
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_users_role" 
        ON "users" ("role");
      `);
    }

    // Индексы для таблицы reviews
    const reviewsExists = await queryRunner.hasTable('reviews');
    if (reviewsExists) {
      // Индекс для поиска отзывов по статусу
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_reviews_status" 
        ON "reviews" ("status");
      `);

      // Индекс для поиска отзывов по мастеру
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_reviews_master" 
        ON "reviews" ("masterId");
      `);
    }

    // Индексы для таблицы notifications
    const notificationsExists = await queryRunner.hasTable('notifications');
    if (notificationsExists) {
      // Индекс для поиска уведомлений по пользователю и статусу
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_notifications_user_status" 
        ON "notifications" ("userId", "status");
      `);

      // Индекс для поиска уведомлений по типу
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_notifications_type" 
        ON "notifications" ("type");
      `);
    }

    // Индексы для таблицы work_schedules
    const workSchedulesExists = await queryRunner.hasTable('work_schedules');
    if (workSchedulesExists) {
      // Индекс для поиска расписания по мастеру и дню недели
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_work_schedules_master_day" 
        ON "work_schedules" ("masterId", "dayOfWeek");
      `);
    }

    // Индексы для таблицы audit_logs
    const auditLogsExists = await queryRunner.hasTable('audit_logs');
    if (auditLogsExists) {
      // Индекс для поиска логов по пользователю
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user" 
        ON "audit_logs" ("userId");
      `);

      // Индекс для поиска логов по действию
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" 
        ON "audit_logs" ("action");
      `);

      // Индекс для поиска логов по дате
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at" 
        ON "audit_logs" ("createdAt");
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем все созданные индексы
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_client_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_master_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_start_time";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_services_parent";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_services_is_category";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_services_is_active";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_telegram_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_phone";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_role";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_master";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_work_schedules_master_day";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at";`);
  }
}

