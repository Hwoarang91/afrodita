import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { authLimiter, appointmentLimiter } from './middleware/rate-limit.middleware';

async function bootstrap() {
  // Настройка кодировки для правильного отображения русского языка
  process.env.LANG = 'C.UTF-8';
  process.env.LC_ALL = 'C.UTF-8';
  
  const logger = new Logger('Bootstrap');
  try {
    logger.log('Инициализация приложения...');
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
    // Временно отключено для отладки
    // app.use(helmet());
    app.use(compression());
    logger.log('Middleware настроены');

  // Rate limiting
  // Применяется глобально, но можно настроить для конкретных роутов
  // app.use('/api/v1/auth', authLimiter);
  // app.use('/api/v1/appointments', appointmentLimiter);

  // CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3002',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
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

  // API prefix
  app.setGlobalPrefix('api/v1');
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
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Backend запущен на порту ${port}`);
  logger.log(`📚 Swagger документация: http://localhost:${port}/api/docs`);
  } catch (error) {
    logger.error('Ошибка при запуске приложения:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Критическая ошибка при запуске приложения:', error);
  process.exit(1);
});

