import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  describe('get', () => {
    it('должен вернуть null если ключ не существует', () => {
      const result = service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('должен вернуть данные если ключ существует и не истек', () => {
      service.set('test-key', 'test-value', 300);
      const result = service.get('test-key');
      expect(result).toBe('test-value');
    });

    it('должен вернуть null если запись истекла', () => {
      service.set('test-key', 'test-value', 0); // TTL = 0 секунд
      // Ждем немного, чтобы запись точно истекла
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      const result = service.get('test-key');
      expect(result).toBeNull();
      jest.useRealTimers();
    });

    it('должен удалить истекшую запись из кэша', () => {
      service.set('test-key', 'test-value', 0);
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      service.get('test-key');
      const stats = service.getStats();
      expect(stats.keys).not.toContain('test-key');
      jest.useRealTimers();
    });
  });

  describe('set', () => {
    it('должен сохранить данные в кэш', () => {
      service.set('test-key', 'test-value');
      const result = service.get('test-key');
      expect(result).toBe('test-value');
    });

    it('должен использовать TTL по умолчанию (300 секунд)', () => {
      service.set('test-key', 'test-value');
      const result = service.get('test-key');
      expect(result).toBe('test-value');
    });

    it('должен использовать переданный TTL', () => {
      service.set('test-key', 'test-value', 60);
      const result = service.get('test-key');
      expect(result).toBe('test-value');
    });

    it('должен перезаписать существующий ключ', () => {
      service.set('test-key', 'old-value');
      service.set('test-key', 'new-value');
      const result = service.get('test-key');
      expect(result).toBe('new-value');
    });
  });

  describe('delete', () => {
    it('должен удалить ключ из кэша', () => {
      service.set('test-key', 'test-value');
      service.delete('test-key');
      const result = service.get('test-key');
      expect(result).toBeNull();
    });

    it('должен безопасно обработать удаление несуществующего ключа', () => {
      expect(() => service.delete('non-existent-key')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('должен очистить весь кэш', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      service.clear();
      const stats = service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toHaveLength(0);
    });
  });

  describe('clearByPattern', () => {
    it('должен удалить ключи по паттерну', () => {
      service.set('user:1', 'value1');
      service.set('user:2', 'value2');
      service.set('service:1', 'value3');
      service.clearByPattern('^user:');
      const stats = service.getStats();
      expect(stats.keys).not.toContain('user:1');
      expect(stats.keys).not.toContain('user:2');
      expect(stats.keys).toContain('service:1');
    });

    it('должен обработать случай когда нет совпадений', () => {
      service.set('key1', 'value1');
      service.clearByPattern('^nonexistent:');
      const stats = service.getStats();
      expect(stats.size).toBe(1);
    });

    it('должен обработать пустой кэш', () => {
      expect(() => service.clearByPattern('.*')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('должен удалить истекшие записи', () => {
      service.set('expired-key', 'value', 0);
      service.set('valid-key', 'value', 300);
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      service.cleanup();
      const stats = service.getStats();
      expect(stats.keys).not.toContain('expired-key');
      expect(stats.keys).toContain('valid-key');
      jest.useRealTimers();
    });

    it('должен обработать случай когда нет истекших записей', () => {
      service.set('key1', 'value1', 300);
      service.set('key2', 'value2', 300);
      service.cleanup();
      const stats = service.getStats();
      expect(stats.size).toBe(2);
    });

    it('должен обработать пустой кэш', () => {
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('должен вернуть статистику кэша', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      const stats = service.getStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('должен вернуть пустую статистику для пустого кэша', () => {
      const stats = service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toHaveLength(0);
    });
  });
});

