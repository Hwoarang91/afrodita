import { INestApplication } from '@nestjs/common';
import { setupTestApp, closeTestApp, getRequest } from './jest-e2e.setup';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('Auth E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let request: ReturnType<typeof getRequest>;

  beforeAll(async () => {
    app = await setupTestApp();
    dataSource = app.get(DataSource);
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    // Очищаем БД перед каждым тестом
    if (dataSource && dataSource.isInitialized) {
      const entities = dataSource.entityMetadatas;
      for (const entity of entities) {
        try {
          const repository = dataSource.getRepository(entity.name);
          await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
        } catch (error) {
          // Игнорируем ошибки
        }
      }
    }
  });

  describe('POST /api/v1/auth/login', () => {
    it('должен успешно авторизовать пользователя с правильными данными', async () => {
      // Создаем тестового пользователя
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = dataSource.getRepository(User).create({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.ADMIN,
        isActive: true,
      });
      await dataSource.getRepository(User).save(user);

      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        role: UserRole.ADMIN,
      });
    });

    it('должен вернуть 401 при неверном пароле', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = dataSource.getRepository(User).create({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        role: UserRole.ADMIN,
        isActive: true,
      });
      await dataSource.getRepository(User).save(user);

      await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('должен вернуть 401 при несуществующем email', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword',
        })
        .expect(401);
    });

    it('должен вернуть 401 для неактивного пользователя', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = dataSource.getRepository(User).create({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        role: UserRole.ADMIN,
        isActive: false, // Неактивный пользователь
      });
      await dataSource.getRepository(User).save(user);

      await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: password,
        })
        .expect(401);
    });

    it('должен вернуть 400 при отсутствии email', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({
          password: 'SomePassword',
        })
        .expect(400);
    });

    it('должен вернуть 400 при отсутствии password', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400);
    });

    it('должен вернуть 400 при невалидном email формате', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'SomePassword',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/telegram', () => {
    it('должен создать нового пользователя при Telegram авторизации', async () => {
      // Мокируем валидные Telegram данные
      const telegramData = {
        id: '123456789',
        first_name: 'Telegram',
        last_name: 'User',
        username: 'telegramuser',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'valid_hash', // В реальности должна быть валидная подпись
      };

      // В реальном тесте нужно мокировать verifyTelegramAuth
      // Для упрощения пропускаем проверку hash
      const response = await request
        .post('/api/v1/auth/telegram')
        .send(telegramData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        telegramId: telegramData.id,
        firstName: telegramData.first_name,
      });
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('должен обновить токен при валидном refresh token', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = dataSource.getRepository(User).create({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        role: UserRole.ADMIN,
        isActive: true,
      });
      await dataSource.getRepository(User).save(user);

      // Получаем токены
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: password,
        })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;

      // Обновляем токен
      const refreshResponse = await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');
    });

    it('должен вернуть 401 при невалидном refresh token', async () => {
      await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);
    });
  });
});

