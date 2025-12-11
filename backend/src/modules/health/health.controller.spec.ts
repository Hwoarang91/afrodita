import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('должен вернуть статус ok', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('должен вернуть timestamp в формате ISO', () => {
      const result = controller.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('apiRoot', () => {
    it('должен вернуть информацию об API', () => {
      const result = controller.apiRoot();

      expect(result).toHaveProperty('message', 'Afrodita Massage Salon API');
      expect(result).toHaveProperty('version', '1.0');
      expect(result).toHaveProperty('documentation', '/api/docs');
      expect(result).toHaveProperty('endpoints');
      expect(result.endpoints).toHaveProperty('health', '/health');
      expect(result.endpoints).toHaveProperty('api', '/api/v1');
      expect(result.endpoints).toHaveProperty('docs', '/api/docs');
    });
  });

  describe('apiV1Root', () => {
    it('должен вернуть информацию об API v1', () => {
      const result = controller.apiV1Root();

      expect(result).toHaveProperty('message', 'Afrodita Massage Salon API v1');
      expect(result).toHaveProperty('version', '1.0');
      expect(result).toHaveProperty('documentation', '/api/docs');
      expect(result).toHaveProperty('endpoints');
      expect(result.endpoints).toHaveProperty('auth', '/api/v1/auth');
      expect(result.endpoints).toHaveProperty('appointments', '/api/v1/appointments');
      expect(result.endpoints).toHaveProperty('services', '/api/v1/services');
      expect(result.endpoints).toHaveProperty('masters', '/api/v1/masters');
      expect(result.endpoints).toHaveProperty('users', '/api/v1/users');
      expect(result.endpoints).toHaveProperty('health', '/health');
    });
  });
});

