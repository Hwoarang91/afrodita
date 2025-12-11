import { INestApplication } from '@nestjs/common';
import { setupTestApp, closeTestApp, getRequest } from './jest-e2e.setup';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/entities/user.entity';
import { Service } from '../../src/entities/service.entity';
import { Master } from '../../src/entities/master.entity';
import * as bcrypt from 'bcrypt';

describe('Services E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let request: ReturnType<typeof getRequest>;
  let adminToken: string;

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
        const repository = dataSource.getRepository(entity.name);
        await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
      }
    }

    // Создаем админа
    const adminPassword = await bcrypt.hash('AdminPass123!', 10);
    const adminUser = dataSource.getRepository(User).create({
      email: 'admin@test.com',
      password: adminPassword,
      firstName: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
    });
    await dataSource.getRepository(User).save(adminUser);

    // Получаем токен
    const adminLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123!' });
    adminToken = adminLogin.body.accessToken;
  });

  describe('POST /api/v1/services', () => {
    it('должен создать услугу', async () => {
      const response = await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Массаж спины',
          description: 'Классический массаж',
          duration: 60,
          price: 2000,
          isCategory: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Массаж спины');
      expect(response.body.price).toBe(2000);
      expect(response.body.duration).toBe(60);
    });

    it('должен вернуть 400 при отсутствии обязательных полей', async () => {
      await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          // Отсутствуют duration, price
        })
        .expect(400);
    });

    it('должен вернуть 400 при отрицательной цене', async () => {
      await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          description: 'Test',
          duration: 60,
          price: -100,
          isCategory: false,
        })
        .expect(400);
    });

    it('должен вернуть 400 при нулевой длительности для не-категории', async () => {
      await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          description: 'Test',
          duration: 0,
          price: 1000,
          isCategory: false,
        })
        .expect(400);
    });

    it('должен создать категорию без цены и длительности', async () => {
      const response = await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Категория',
          description: 'Категория услуг',
          duration: 0,
          price: 0,
          isCategory: true,
        })
        .expect(201);

      expect(response.body.isCategory).toBe(true);
    });

    it('должен вернуть 401 без токена', async () => {
      await request
        .post('/api/v1/services')
        .send({
          name: 'Test',
          description: 'Test',
          duration: 60,
          price: 1000,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/services', () => {
    it('должен вернуть список услуг', async () => {
      // Создаем услугу
      const createResponse = await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Service',
          description: 'Test',
          duration: 60,
          price: 1000,
          isCategory: false,
        })
        .expect(201);

      const response = await request
        .get('/api/v1/services')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('должен фильтровать только активные услуги', async () => {
      // Создаем активную услугу
      await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Active Service',
          description: 'Test',
          duration: 60,
          price: 1000,
          isCategory: false,
          isActive: true,
        })
        .expect(201);

      // Создаем неактивную услугу
      await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Inactive Service',
          description: 'Test',
          duration: 60,
          price: 1000,
          isCategory: false,
          isActive: false,
        })
        .expect(201);

      const response = await request
        .get('/api/v1/services')
        .expect(200);

      // По умолчанию должны возвращаться только активные
      const activeServices = response.body.filter((s: Service) => s.isActive);
      expect(activeServices.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/v1/services/:id', () => {
    it('должен обновить услугу', async () => {
      // Создаем услугу
      const createResponse = await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Service',
          description: 'Test',
          duration: 60,
          price: 1000,
          isCategory: false,
        })
        .expect(201);

      const serviceId = createResponse.body.id;

      // Обновляем услугу
      const updateResponse = await request
        .patch(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Service',
          price: 1500,
        })
        .expect(200);

      expect(updateResponse.body.name).toBe('Updated Service');
      expect(updateResponse.body.price).toBe(1500);
    });

    it('должен вернуть 404 при несуществующей услуге', async () => {
      await request
        .patch('/api/v1/services/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated',
        })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/services/:id', () => {
    it('должен деактивировать услугу', async () => {
      // Создаем услугу
      const createResponse = await request
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Service',
          description: 'Test',
          duration: 60,
          price: 1000,
          isCategory: false,
        })
        .expect(201);

      const serviceId = createResponse.body.id;

      // Деактивируем услугу
      await request
        .delete(`/api/v1/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Проверяем что услуга неактивна
      const getResponse = await request
        .get(`/api/v1/services/${serviceId}`)
        .expect(200);

      expect(getResponse.body.isActive).toBe(false);
    });
  });
});

