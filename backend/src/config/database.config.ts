import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USER', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_NAME', 'afrodita'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: this.configService.get<string>('NODE_ENV') !== 'production',
      logging: this.configService.get<string>('NODE_ENV') === 'development',
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

