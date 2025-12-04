import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Проверяем, не истек ли срок действия
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Сохранить значение в кэш
   * @param key - ключ кэша
   * @param data - данные для кэширования
   * @param ttlSeconds - время жизни в секундах (по умолчанию 300 = 5 минут)
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Удалить значение из кэша
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Очистить все значения из кэша
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Очистить кэш по паттерну ключа
   */
  clearByPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Очищено ${keysToDelete.length} записей кэша по паттерну: ${pattern}`);
    }
  }

  /**
   * Очистить истекшие записи из кэша
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Очищено ${keysToDelete.length} истекших записей кэша`);
    }
  }

  /**
   * Получить статистику кэша
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

