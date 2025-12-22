import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppDataSource } from './config/data-source';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import * as cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';

async function bootstrap() {
  // Настройка кодировки для правильного отображения русского языка
  process.env.LANG = 'C.UTF-8';
  process.env.LC_ALL = 'C.UTF-8';
  
  const logger = new Logger('Bootstrap');
  try {
    logger.log('Инициализация приложения...');
    
    // Выполнение миграций при старте (только в production)
    if (process.env.NODE_ENV === 'production' && process.env.AUTO_RUN_MIGRATIONS !== 'false') {
      let dataSourceInitialized = false;
      try {
        logger.log('Проверка и выполнение миграций базы данных...');
        
        // Проверяем наличие миграций
        const migrationsPath = path.join(__dirname, 'migrations');
        if (fs.existsSync(migrationsPath)) {
          const migrations = fs.readdirSync(migrationsPath).filter((f: string) => f.endsWith('.js'));
          logger.log(`Найдено ${migrations.length} файлов миграций в ${migrationsPath}`);
        } else {
          logger.warn(`Директория миграций не найдена: ${migrationsPath}`);
        }
        
        if (!AppDataSource.isInitialized) {
          await AppDataSource.initialize();
          dataSourceInitialized = true;
          logger.log('AppDataSource инициализирован для миграций');
        }
        
        // Проверяем, есть ли таблицы в базе данных
        const tables = await AppDataSource.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name != 'migrations'
        `);
        
        if (tables.length === 0) {
          logger.warn('⚠️ Таблицы не найдены в базе данных. Включаю синхронизацию для создания таблиц...');
          // Временно включаем синхронизацию для создания таблиц
          const tempDataSource = new DataSource({
            ...AppDataSource.options,
            synchronize: true,
          });
          await tempDataSource.initialize();
          logger.log('✅ Таблицы созданы через синхронизацию');
          await tempDataSource.destroy();
        } else {
          logger.log(`Найдено ${tables.length} таблиц в базе данных`);
        }
        
        // Выполняем миграции - runMigrations вернет только те, которые были выполнены
        const executedMigrations = await AppDataSource.runMigrations();
        if (executedMigrations && executedMigrations.length > 0) {
          logger.log(`✅ Применено ${executedMigrations.length} миграций:`);
          executedMigrations.forEach((migration) => {
            logger.log(`  - ${migration.name}`);
          });
        } else {
          logger.log('✅ Все миграции уже применены');
        }
      } catch (migrationError: unknown) {
        const error = migrationError instanceof Error ? migrationError : new Error(String(migrationError));
        logger.error('⚠️ Ошибка при выполнении миграций:', error.message);
        logger.error('Stack:', error.stack);
        logger.warn('Приложение продолжит запуск. Выполните миграции вручную: npm run migration:run');
        // Не прерываем запуск приложения, но логируем ошибку
      } finally {
        // Закрываем соединение после миграций, чтобы избежать конфликтов с TypeORM модулем NestJS
        if (dataSourceInitialized && AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          logger.log('Соединение с БД для миграций закрыто');
        }
      }
    }
    // Увеличиваем лимит размера тела запроса для загрузки изображений (base64)
    // Лимит настроен в nginx (client_max_body_size 50M), что достаточно для большинства случаев
    // Встроенный body parser NestJS имеет лимит по умолчанию, но nginx будет фильтровать большие запросы
    logger.log('Создание NestFactory...');
    const app = await NestFactory.create(AppModule, {
      bodyParser: true,
      rawBody: false,
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      forceCloseConnections: true, // Принудительно закрывать соединения при завершении
    });
    logger.log('NestFactory создан');
    
    // Проверяем подключение TypeORM перед запуском сервера
    try {
      const dataSource = app.get(DataSource);
      if (dataSource && dataSource.isInitialized) {
        logger.log('TypeORM DataSource инициализирован');
      } else {
        logger.warn('TypeORM DataSource не инициализирован, но продолжаем запуск');
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Не удалось проверить TypeORM DataSource: ${err.message}`);
    }

    // Security
    if (process.env.NODE_ENV === 'production') {
      app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      }));
    }
    app.use(compression());

    // Cookie parser для работы с httpOnly cookies
    app.use(cookieParser());

    logger.log('Middleware настроены');

  // Rate limiting
  // Применяется глобально, но можно настроить для конкретных роутов
  // app.use('/api/v1/auth', authLimiter);
  // app.use('/api/v1/appointments', appointmentLimiter);

  // CORS
  const allowedOrigins: (string | RegExp)[] = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
      ].filter((origin): origin is string => Boolean(origin))
    : [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.ADMIN_URL || 'http://localhost:3002',
        'http://localhost:3001',
        'http://localhost:3002',
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const logger = new Logger('ValidationPipe');
        logger.error(`Validation failed: ${JSON.stringify(errors, null, 2)}`);
        
        // Возвращаем BadRequestException с массивом ValidationError
        // ValidationExceptionFilter преобразует это в стандартизированный ErrorResponse
        return new BadRequestException({
          message: errors.map((err) => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          })),
          error: 'Bad Request',
          statusCode: 400,
        });
      },
    }),
  );

  // Exception filter для логирования ValidationPipe ошибок
  app.useGlobalFilters(new ValidationExceptionFilter());

  // API prefix (исключаем health endpoint и корневые API роуты)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/api', '/api/v1', '/api/docs'],
  });
  logger.log('API prefix установлен');

  // Swagger documentation - настраиваем ДО запуска сервера
  logger.log('Настройка Swagger...');
  const config = new DocumentBuilder()
    .setTitle('Afrodita Massage Salon API')
    .setDescription('API для Telegram-бота и Web App массажного салона')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Аутентификация')
    .addTag('appointments', 'Записи')
    .addTag('services', 'Услуги')
    .addTag('masters', 'Мастера')
    .addTag('users', 'Пользователи')
    .addTag('notifications', 'Уведомления')
    .addTag('analytics', 'Аналитика')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  logger.log('Swagger настроен');

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;
  logger.log(`Запуск сервера на порту ${port}...`);
  
  try {
    logger.log(`Вызов app.listen(${port}, '0.0.0.0')...`);
    
    // Запускаем сервер - app.listen() должен автоматически инициализировать приложение
    const httpServer = await app.listen(port, '0.0.0.0');
    logger.log(`app.listen() завершился, httpServer получен`);
    
    // Даем серверу немного времени на запуск
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Проверяем через HttpAdapterHost
    const httpAdapterHost = app.get(HttpAdapterHost);
    const isListening = httpAdapterHost?.listening || httpServer?.listening || false;
    
    if (isListening) {
      logger.log(`✅ Backend успешно запущен на порту ${port}`);
      logger.log(`📚 Swagger документация: http://0.0.0.0:${port}/api/docs`);
      logger.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
    } else {
      // Проверяем, может сервер все равно работает, но listening еще не обновился
      logger.warn(`⚠️ listening = false, но продолжаем работу`);
      logger.log(`HttpAdapterHost.listening: ${httpAdapterHost?.listening}`);
      logger.log(`httpServer.listening: ${httpServer?.listening}`);
      logger.log(`✅ Backend запущен на порту ${port} (проверка статуса может быть неточной)`);
      logger.log(`📚 Swagger документация: http://0.0.0.0:${port}/api/docs`);
      logger.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
    }
  } catch (listenError: unknown) {
    const error = listenError instanceof Error ? listenError : new Error(String(listenError));
    logger.error(`❌ Ошибка при запуске сервера на порту ${port}:`, error.message);
    logger.error(`Stack trace:`, error.stack);
    throw error;
  }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Ошибка при запуске приложения:', err.message);
    logger.error('Stack:', err.stack);
    // Закрываем соединение с DataSource при ошибке
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => {
        // Игнорируем ошибки при закрытии
      });
    }
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Критическая ошибка при запуске приложения:', error);
  process.exit(1);
});

