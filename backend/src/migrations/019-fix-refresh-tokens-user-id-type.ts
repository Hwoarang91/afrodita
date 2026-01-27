import { MigrationInterface, QueryRunner } from 'typeorm';
import { getErrorMessage } from '../common/utils/error-message';

export class FixRefreshTokensUserIdType1703123456789 implements MigrationInterface {
  name = 'FixRefreshTokensUserIdType1703123456789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы refresh_tokens
    const tableExists = await queryRunner.hasTable('refresh_tokens');
    
    if (!tableExists) {
      console.log('Таблица refresh_tokens не существует, пропускаем миграцию');
      return;
    }
    
    // Проверяем текущий тип колонки user_id
    const columnInfo = await queryRunner.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'refresh_tokens' 
      AND column_name = 'user_id';
    `);
    
    if (columnInfo.length === 0) {
      console.log('Колонка user_id не существует в таблице refresh_tokens, пропускаем миграцию');
      return;
    }
    
    const currentType = columnInfo[0].data_type;
    
    if (currentType === 'uuid') {
      console.log('Колонка user_id уже имеет тип uuid, пропускаем миграцию');
      return;
    }
    
    // Удаляем невалидные записи (где user_id не является валидным UUID)
    try {
      await queryRunner.query(`
        DELETE FROM refresh_tokens 
        WHERE user_id IS NOT NULL 
        AND user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      `);
      console.log('Удалены невалидные записи из refresh_tokens');
    } catch (error: unknown) {
      console.log('Ошибка при удалении невалидных записей (возможно, таблица пустая):', getErrorMessage(error));
    }
    
    // Изменяем тип колонки user_id с character varying на uuid
    try {
      await queryRunner.query(`
        ALTER TABLE refresh_tokens 
        ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
      `);
      console.log('Тип колонки user_id успешно изменен с character varying на uuid');
    } catch (error: unknown) {
      console.error('Ошибка при изменении типа колонки user_id:', getErrorMessage(error));
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование таблицы refresh_tokens
    const tableExists = await queryRunner.hasTable('refresh_tokens');
    
    if (!tableExists) {
      console.log('Таблица refresh_tokens не существует, пропускаем откат миграции');
      return;
    }
    
    // Проверяем текущий тип колонки user_id
    const columnInfo = await queryRunner.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'refresh_tokens' 
      AND column_name = 'user_id';
    `);
    
    if (columnInfo.length === 0) {
      console.log('Колонка user_id не существует в таблице refresh_tokens, пропускаем откат миграции');
      return;
    }
    
    const currentType = columnInfo[0].data_type;
    
    if (currentType === 'character varying') {
      console.log('Колонка user_id уже имеет тип character varying, пропускаем откат миграции');
      return;
    }
    
    // Изменяем тип колонки user_id обратно с uuid на character varying
    try {
      await queryRunner.query(`
        ALTER TABLE refresh_tokens 
        ALTER COLUMN user_id TYPE character varying USING user_id::text;
      `);
      console.log('Тип колонки user_id успешно изменен обратно с uuid на character varying');
    } catch (error: unknown) {
      console.error('Ошибка при откате типа колонки user_id:', getErrorMessage(error));
      throw error;
    }
  }
}

