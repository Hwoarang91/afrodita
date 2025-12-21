import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionStatusFields1704000000000 implements MigrationInterface {
  name = 'AddSessionStatusFields1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы telegram_user_sessions
    const tableExists = await queryRunner.hasTable('telegram_user_sessions');
    
    if (!tableExists) {
      console.log('Таблица telegram_user_sessions не существует, пропускаем миграцию');
      return;
    }

    // Добавляем колонку status
    const statusColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'status';
    `);

    if (statusColumnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        ADD COLUMN status VARCHAR(20) DEFAULT 'initializing' 
        CHECK (status IN ('active', 'invalid', 'revoked', 'initializing'));
      `);
      console.log('Колонка status добавлена в telegram_user_sessions');
    } else {
      console.log('Колонка status уже существует, пропускаем');
    }

    // Добавляем колонку invalid_reason
    const invalidReasonColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'invalid_reason';
    `);

    if (invalidReasonColumnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        ADD COLUMN invalid_reason VARCHAR(255) NULL;
      `);
      console.log('Колонка invalid_reason добавлена в telegram_user_sessions');
    } else {
      console.log('Колонка invalid_reason уже существует, пропускаем');
    }

    // Добавляем колонку dc_id
    const dcIdColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'dc_id';
    `);

    if (dcIdColumnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        ADD COLUMN dc_id INTEGER NULL;
      `);
      console.log('Колонка dc_id добавлена в telegram_user_sessions');
    } else {
      console.log('Колонка dc_id уже существует, пропускаем');
    }

    // Добавляем CHECK constraint против пустого объекта '{}'
    const checkConstraintExists = await queryRunner.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND constraint_name = 'encrypted_session_data_not_empty';
    `);

    if (checkConstraintExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions
        ADD CONSTRAINT encrypted_session_data_not_empty
        CHECK (encrypted_session_data IS NULL OR encrypted_session_data <> '{}');
      `);
      console.log('CHECK constraint добавлен: запрещено сохранение пустого объекта {}');
    } else {
      console.log('CHECK constraint уже существует, пропускаем');
    }

    // Обновляем существующие записи: если is_active = true, то status = 'active', иначе 'invalid'
    await queryRunner.query(`
      UPDATE telegram_user_sessions 
      SET status = CASE 
        WHEN is_active = true THEN 'active'
        ELSE 'invalid'
      END
      WHERE status IS NULL OR status = 'initializing';
    `);
    console.log('Обновлены существующие записи: установлен статус на основе is_active');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы telegram_user_sessions
    const tableExists = await queryRunner.hasTable('telegram_user_sessions');
    
    if (!tableExists) {
      console.log('Таблица telegram_user_sessions не существует, пропускаем откат миграции');
      return;
    }

    // Удаляем колонку dc_id
    const dcIdColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'dc_id';
    `);

    if (dcIdColumnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        DROP COLUMN dc_id;
      `);
      console.log('Колонка dc_id удалена из telegram_user_sessions');
    }

    // Удаляем колонку invalid_reason
    const invalidReasonColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'invalid_reason';
    `);

    if (invalidReasonColumnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        DROP COLUMN invalid_reason;
      `);
      console.log('Колонка invalid_reason удалена из telegram_user_sessions');
    }

    // Удаляем колонку status
    const statusColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_user_sessions' 
      AND column_name = 'status';
    `);

    if (statusColumnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE telegram_user_sessions 
        DROP COLUMN status;
      `);
      console.log('Колонка status удалена из telegram_user_sessions');
    }
  }
}

