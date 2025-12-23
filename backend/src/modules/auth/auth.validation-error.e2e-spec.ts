/**
 * E2E тест для проверки ErrorResponse контракта при ошибках валидации
 * Проверяет, что все ошибки валидации возвращают ErrorResponse с message: string
 * 
 * Запуск: npm test -- auth.validation-error.e2e-spec
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { buildValidationErrorResponse } from '../../common/utils/error-response.builder';
import { validateErrorResponse } from '../../common/interfaces/error-response.contract.spec';

describe('Auth Validation Error E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // КРИТИЧНО: Используем тот же ValidationPipe, что и в main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const errorResponse = buildValidationErrorResponse(errors);
          return new (require('@nestjs/common').BadRequestException)(errorResponse);
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/telegram/2fa/verify', () => {
    it('должен возвращать ErrorResponse с message: string при невалидной DTO', async () => {
      const invalidDto = {
        // ❌ Отсутствуют обязательные поля
        phoneNumber: null,
        password: 123, // ❌ не строка
        phoneCodeHash: undefined,
        // ❌ Лишнее поле (должно быть заблокировано forbidNonWhitelisted)
        userId: 'should-not-be-here',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/2fa/verify')
        .send(invalidDto)
        .expect(400);

      // КРИТИЧНО: Проверяем, что response.body соответствует ErrorResponse контракту
      expect(validateErrorResponse(response.body)).toBe(true);
      
      // КРИТИЧНО: message должен быть строкой, а не массивом или объектом
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.message)).toBe(false);
      expect(typeof response.body.message).not.toBe('object');
      
      // Проверяем обязательные поля ErrorResponse
      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      
      // Проверяем, что details есть и это массив
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);
      
      // Проверяем, что каждое detail имеет правильную структуру
      response.body.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(typeof detail.message).toBe('string');
      });
    });

    it('должен возвращать ErrorResponse с message: string при пустом теле запроса', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/2fa/verify')
        .send({})
        .expect(400);

      expect(validateErrorResponse(response.body)).toBe(true);
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.message)).toBe(false);
    });

    it('должен возвращать ErrorResponse с message: string при невалидном типе данных', async () => {
      const invalidDto = {
        phoneNumber: 12345, // ❌ не строка
        password: ['not', 'a', 'string'], // ❌ массив вместо строки
        phoneCodeHash: { invalid: 'object' }, // ❌ объект вместо строки
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/2fa/verify')
        .send(invalidDto)
        .expect(400);

      expect(validateErrorResponse(response.body)).toBe(true);
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.message)).toBe(false);
      
      // Проверяем, что details содержат информацию о всех ошибках
      expect(response.body.details.length).toBeGreaterThanOrEqual(3);
    });

    it('должен блокировать лишние поля (forbidNonWhitelisted)', async () => {
      const invalidDto = {
        phoneNumber: '+79991234567',
        password: 'test123',
        phoneCodeHash: 'abc123',
        // ❌ Лишние поля, которые должны быть заблокированы
        userId: 'should-not-be-here',
        sessionId: 'should-not-be-here',
        extraField: 'should-not-be-here',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/2fa/verify')
        .send(invalidDto)
        .expect(400);

      expect(validateErrorResponse(response.body)).toBe(true);
      expect(typeof response.body.message).toBe('string');
      
      // Проверяем, что в details есть информация о заблокированных полях
      const blockedFields = response.body.details.filter(
        (detail: any) => detail.message.includes('should not exist') || detail.message.includes('forbidden')
      );
      expect(blockedFields.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/telegram/phone/verify', () => {
    it('должен возвращать ErrorResponse с message: string при невалидной DTO', async () => {
      const invalidDto = {
        phoneNumber: null,
        code: 12345, // ❌ не строка
        phoneCodeHash: undefined,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/phone/verify')
        .send(invalidDto)
        .expect(400);

      expect(validateErrorResponse(response.body)).toBe(true);
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.message)).toBe(false);
    });
  });

  describe('POST /api/v1/auth/telegram/phone/request', () => {
    it('должен возвращать ErrorResponse с message: string при невалидной DTO', async () => {
      const invalidDto = {
        phoneNumber: 12345, // ❌ не строка
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/telegram/phone/request')
        .send(invalidDto)
        .expect(400);

      expect(validateErrorResponse(response.body)).toBe(true);
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.message)).toBe(false);
    });
  });
});

