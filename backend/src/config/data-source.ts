import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения
config({ path: resolve(__dirname, '../../../.env') });

// В production все параметры БД должны быть установлены
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    throw new Error('Database configuration is required in production: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set');
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'postgres'),
  database: process.env.DB_NAME || 'afrodita',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: process.env.NODE_ENV === 'production' 
    ? [__dirname + '/../migrations/*.js']  // В production только .js файлы
    : [__dirname + '/../migrations/*{.ts,.js}'],  // В development .ts и .js
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

