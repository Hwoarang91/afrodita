import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsEnum,
  validateSync,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV?: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  PORT?: number;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  BACKEND_PORT?: number;

  // Database
  @IsString()
  @IsOptional()
  DB_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  DB_PORT?: number;

  @IsString()
  @IsOptional()
  DB_USER?: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD?: string;

  @IsString()
  @IsOptional()
  DB_NAME?: string;

  @IsString()
  @IsOptional()
  DB_SSL?: string;

  // Redis
  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  REDIS_PORT?: number;

  // JWT
  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN?: string;

  // Telegram
  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN?: string;

  // Telegram Heartbeat
  @IsString()
  @IsOptional()
  TELEGRAM_HEARTBEAT_ENABLED?: string;

  @IsInt()
  @Min(60000) // Минимум 60 секунд
  @Max(600000) // Максимум 10 минут
  @IsOptional()
  @Type(() => Number)
  TELEGRAM_HEARTBEAT_INTERVAL?: number;

  @IsInt()
  @Min(5000) // Минимум 5 секунд
  @Max(60000) // Максимум 60 секунд
  @IsOptional()
  @Type(() => Number)
  TELEGRAM_HEARTBEAT_TIMEOUT?: number;

  // Telegram Event Log
  @IsInt()
  @Min(100) // Минимум 100 событий
  @Max(10000) // Максимум 10000 событий
  @IsOptional()
  @Type(() => Number)
  TELEGRAM_EVENT_LOG_HISTORY_SIZE?: number;

  // CORS
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  ADMIN_URL?: string;

  // Migrations
  @IsString()
  @IsOptional()
  AUTO_RUN_MIGRATIONS?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true, // Пропускаем отсутствующие свойства
    whitelist: true, // Удаляем невалидные свойства
    forbidNonWhitelisted: false, // Не выбрасываем ошибку для неизвестных свойств
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        return error.toString();
      })
      .join('; ');
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }

  return validatedConfig;
}
