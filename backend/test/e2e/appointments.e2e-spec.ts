import { INestApplication } from '@nestjs/common';
import { setupTestApp, closeTestApp, getRequest } from './jest-e2e.setup';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/entities/user.entity';
import { Service } from '../../src/entities/service.entity';
import { Master } from '../../src/entities/master.entity';
import { Appointment, AppointmentStatus } from '../../src/entities/appointment.entity';
import { WorkSchedule, DayOfWeek } from '../../src/entities/work-schedule.entity';
import * as bcrypt from 'bcrypt';

describe('Appointments E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let request: ReturnType<typeof getRequest>;
  let clientToken: string;
  let adminToken: string;
  let clientUser: User;
  let masterUser: User;
  let service: Service;
  let master: Master;

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

    // Создаем клиента
    const clientPassword = await bcrypt.hash('ClientPass123!', 10);
    clientUser = dataSource.getRepository(User).create({
      email: 'client@test.com',
      password: clientPassword,
      firstName: 'Client',
      lastName: 'User',
      role: UserRole.CLIENT,
      isActive: true,
    });
    await dataSource.getRepository(User).save(clientUser);

    // Создаем мастера
    const masterPassword = await bcrypt.hash('MasterPass123!', 10);
    masterUser = dataSource.getRepository(User).create({
      email: 'master@test.com',
      password: masterPassword,
      firstName: 'Master',
      lastName: 'User',
      role: UserRole.MASTER,
      isActive: true,
    });
    await dataSource.getRepository(User).save(masterUser);

    // Создаем админа
    const adminPassword = await bcrypt.hash('AdminPass123!', 10);
    const adminUser = dataSource.getRepository(User).create({
      email: 'admin@test.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
    });
    await dataSource.getRepository(User).save(adminUser);

    // Создаем услугу
    service = dataSource.getRepository(Service).create({
      name: 'Массаж спины',
      description: 'Классический массаж спины',
      duration: 60,
      price: 2000,
      isActive: true,
      isCategory: false,
    });
    await dataSource.getRepository(Service).save(service);

    // Создаем мастера
    master = dataSource.getRepository(Master).create({
      userId: masterUser.id,
      name: 'Иван Иванов',
      isActive: true,
      services: [service],
    });
    await dataSource.getRepository(Master).save(master);

    // Создаем расписание мастера (понедельник, 9:00-18:00)
    const workSchedule = dataSource.getRepository(WorkSchedule).create({
      masterId: master.id,
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '09:00',
      endTime: '18:00',
      isActive: true,
    });
    await dataSource.getRepository(WorkSchedule).save(workSchedule);

    // Получаем токены
    const clientLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.com', password: 'ClientPass123!' });
    clientToken = clientLogin.body.accessToken;

    const adminLogin = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123!' });
    adminToken = adminLogin.body.accessToken;
  });

  describe('POST /api/v1/appointments', () => {
    it('должен создать запись для клиента', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const response = await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(AppointmentStatus.PENDING);
      expect(response.body.clientId).toBe(clientUser.id);
      expect(response.body.serviceId).toBe(service.id);
      expect(response.body.masterId).toBe(master.id);
    });

    it('должен вернуть 404 при несуществующем мастере', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: '00000000-0000-0000-0000-000000000000',
          startTime: tomorrow.toISOString(),
        })
        .expect(404);
    });

    it('должен вернуть 404 при несуществующей услуге', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: '00000000-0000-0000-0000-000000000000',
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(404);
    });

    it('должен вернуть 400 при занятом времени', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Создаем первую запись
      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      // Пытаемся создать вторую запись на то же время
      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(400);
    });

    it('должен вернуть 400 при записи в прошлое', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 0, 0, 0);

      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: yesterday.toISOString(),
        })
        .expect(400);
    });

    it('должен вернуть 400 при записи вне рабочего времени', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(20, 0, 0, 0); // 20:00 - вне рабочего времени

      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(400);
    });

    it('должен вернуть 401 без токена', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await request
        .post('/api/v1/appointments')
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/appointments/:id/cancel', () => {
    it('должен отменить запись', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Создаем запись
      const createResponse = await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      const appointmentId = createResponse.body.id;

      // Отменяем запись
      const cancelResponse = await request
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(cancelResponse.body.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('должен вернуть 404 при несуществующей записи', async () => {
      await request
        .patch('/api/v1/appointments/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);
    });

    it('должен вернуть 403 при попытке отменить чужую запись', async () => {
      // Создаем второго клиента
      const otherClientPassword = await bcrypt.hash('OtherPass123!', 10);
      const otherClient = dataSource.getRepository(User).create({
        email: 'other@test.com',
        password: otherClientPassword,
        firstName: 'Other',
        role: UserRole.CLIENT,
        isActive: true,
      });
      await dataSource.getRepository(User).save(otherClient);

      const otherClientLogin = await request
        .post('/api/v1/auth/login')
        .send({ email: 'other@test.com', password: 'OtherPass123!' });
      const otherClientToken = otherClientLogin.body.accessToken;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Создаем запись от первого клиента
      const createResponse = await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      const appointmentId = createResponse.body.id;

      // Пытаемся отменить чужую запись
      await request
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${otherClientToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/appointments/:id/reschedule', () => {
    it('должен перенести запись', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Создаем запись
      const createResponse = await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      const appointmentId = createResponse.body.id;

      // Переносим на другое время
      const newTime = new Date(tomorrow);
      newTime.setHours(14, 0, 0, 0);

      const rescheduleResponse = await request
        .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          startTime: newTime.toISOString(),
        })
        .expect(200);

      expect(rescheduleResponse.body.status).toBe(AppointmentStatus.RESCHEDULED);
      expect(new Date(rescheduleResponse.body.startTime).getHours()).toBe(14);
    });

    it('должен вернуть 400 при переносе на занятое время', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Создаем первую запись
      await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: tomorrow.toISOString(),
        })
        .expect(201);

      // Создаем вторую запись
      const createResponse2 = await request
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId: service.id,
          masterId: master.id,
          startTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const appointmentId2 = createResponse2.body.id;

      // Пытаемся перенести на занятое время
      await request
        .patch(`/api/v1/appointments/${appointmentId2}/reschedule`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          startTime: tomorrow.toISOString(),
        })
        .expect(400);
    });
  });
});

