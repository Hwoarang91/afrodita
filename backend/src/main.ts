import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { authLimiter, appointmentLimiter } from './middleware/rate-limit.middleware';
import { AppDataSource } from './config/data-source';

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
        const fs = require('fs');
        const path = require('path');
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
          const tempDataSource = new (require('typeorm').DataSource)({
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
          executedMigrations.forEach((migration: any) => {
            logger.log(`  - ${migration.name}`);
          });
        } else {
          logger.log('✅ Все миграции уже применены');
        }
      } catch (migrationError: any) {
        logger.error('⚠️ Ошибка при выполнении миграций:', migrationError.message);
        logger.error('Stack:', migrationError.stack);
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
    const app = await NestFactory.create(AppModule, {
      bodyParser: true,
      rawBody: false,
    });
    // Увеличиваем лимит для JSON body parser (по умолчанию 100kb, увеличиваем до 10MB)
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    logger.log('Приложение создано');

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
    logger.log('Middleware настроены');

  // Rate limiting
  // Применяется глобально, но можно настроить для конкретных роутов
  // app.use('/api/v1/auth', authLimiter);
  // app.use('/api/v1/appointments', appointmentLimiter);

  // CORS
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
      ].filter(Boolean)
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
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix (исключаем health endpoint)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
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

  const port = process.env.PORT || 3001;
  logger.log(`Запуск сервера на порту ${port}...`);
  
  // Инициализируем приложение - это зарегистрирует все маршруты
  // Используем таймаут, чтобы избежать зависания
  logger.log('Инициализация приложения для регистрации маршрутов...');
  
  const initPromise = app.init();
  const initTimeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Init timeout')), 5000)
  );
  
  try {
    await Promise.race([initPromise, initTimeout]);
    logger.log('Приложение инициализировано, маршруты зарегистрированы');
  } catch (error: any) {
    if (error.message === 'Init timeout') {
      logger.warn('Таймаут при инициализации, но продолжаем - маршруты могут быть уже зарегистрированы');
    } else {
      throw error;
    }
  }
  
  // Даем дополнительное время на завершение регистрации маршрутов
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Используем app.listen() вместо httpServer.listen() для правильного вызова lifecycle hooks
  // Это гарантирует, что OnApplicationBootstrap будет вызван
  logger.log(`Попытка запуска сервера на порту ${port}...`);
  try {
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 Backend запущен на порту ${port}`);
    logger.log(`📚 Swagger документация: http://localhost:${port}/api/docs`);
  } catch (listenError: any) {
    logger.error(`Ошибка при запуске сервера на порту ${port}:`, listenError.message);
    throw listenError;
  }
  } catch (error) {
    logger.error('Ошибка при запуске приложения:', error);
    // Закрываем соединение с DataSource при ошибке
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => {});
    }
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Критическая ошибка при запуске приложения:', error);
  process.exit(1);
});

