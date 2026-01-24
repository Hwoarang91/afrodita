import { Injectable, Logger } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TypeOrmSlowQueryLogger } from './typeorm-slow-query.logger';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';

    // В production все параметры БД должны быть установлены
    if (isProduction) {
      const dbHost = this.configService.get<string>('DB_HOST');
      const dbUser = this.configService.get<string>('DB_USER');
      const dbPassword = this.configService.get<string>('DB_PASSWORD');
      const dbName = this.configService.get<string>('DB_NAME');

      if (!dbHost || !dbUser || !dbPassword || !dbName) {
        throw new Error('Database configuration is required in production: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set');
      }
    }

    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USER', 'postgres'),
      password: isProduction
        ? this.configService.get<string>('DB_PASSWORD')!
        : this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_NAME', 'afrodita'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: !isProduction,
      logging: !isProduction,
      ...(isProduction && {
        maxQueryExecutionTime: this.configService.get<number>('DB_SLOW_QUERY_MS', 5000),
        logger: new TypeOrmSlowQueryLogger(new Logger('TypeORM')),
      }),
      ssl: this.configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      retryAttempts: 10,
      retryDelay: 3000,
      autoLoadEntities: true,
      connectTimeoutMS: 10000, // Таймаут подключения 10 секунд
      extra: {
        max: 10, // Максимальное количество соединений в пуле
        connectionTimeoutMillis: 10000,
      },
    };
  }
}

