import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  validateSync,
  Min,
  Max,
  ValidateIf,
  MinLength,
  IsUrl,
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
  @ValidateIf((o) => o.NODE_ENV === 'production')
  @IsOptional()
  DB_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  DB_PORT?: number;

  @IsString()
  @ValidateIf((o) => o.NODE_ENV === 'production')
  @IsOptional()
  DB_USER?: string;

  @IsString()
  @ValidateIf((o) => o.NODE_ENV === 'production')
  @MinLength(8, { message: 'DB_PASSWORD must be at least 8 characters long in production' })
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
  @ValidateIf((o) => o.NODE_ENV === 'production')
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long in production' })
  @IsOptional()
  JWT_SECRET?: string;

  // Session Secret (может использовать JWT_SECRET как fallback)
  @IsString()
  @ValidateIf((o) => o.NODE_ENV === 'production' && !o.JWT_SECRET)
  @MinLength(32, { message: 'SESSION_SECRET must be at least 32 characters long in production if JWT_SECRET is not set' })
  @IsOptional()
  SESSION_SECRET?: string;

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
  @IsUrl({}, { message: 'FRONTEND_URL must be a valid URL' })
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsUrl({}, { message: 'ADMIN_URL must be a valid URL' })
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

  const isProduction = validatedConfig.NODE_ENV === 'production';

  // В production проверяем обязательные поля
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: !isProduction, // В production не пропускаем отсутствующие обязательные свойства
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

  // Дополнительная проверка для production
  if (isProduction) {
    const requiredFields = [
      // JWT_SECRET или SESSION_SECRET должны быть установлены (хотя бы один)
      { name: 'JWT_SECRET or SESSION_SECRET', value: validatedConfig.JWT_SECRET || validatedConfig.SESSION_SECRET },
      { name: 'DB_HOST', value: validatedConfig.DB_HOST },
      { name: 'DB_USER', value: validatedConfig.DB_USER },
      { name: 'DB_PASSWORD', value: validatedConfig.DB_PASSWORD },
      { name: 'DB_NAME', value: validatedConfig.DB_NAME },
    ];

    const missingFields = requiredFields
      .filter((field) => !field.value)
      .map((field) => field.name);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required environment variables in production: ${missingFields.join(', ')}`,
      );
    }
  }

  return validatedConfig;
}
