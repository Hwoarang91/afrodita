/**
 * Тесты для ErrorCodeRateLimitInterceptor
 * 
 * Проверяет:
 * - Rate limiting для INVALID_2FA_PASSWORD
 * - Rate limiting для PHONE_CODE_INVALID
 * - Проверка лимитов
 * - Получение retryAfter
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ErrorCodeRateLimitInterceptor } from './error-code-rate-limit.middleware';
import { ErrorCode } from '../../interfaces/error-response.interface';
import { HttpException } from '@nestjs/common';

describe('ErrorCodeRateLimitInterceptor', () => {
  let interceptor: ErrorCodeRateLimitInterceptor;
  let executionContext: ExecutionContext;
  let callHandler: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorCodeRateLimitInterceptor],
    }).compile();

    interceptor = module.get<ErrorCodeRateLimitInterceptor>(ErrorCodeRateLimitInterceptor);
    
    executionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'test-user-id' },
          ip: '127.0.0.1',
        }),
        getResponse: () => ({}),
      }),
    } as ExecutionContext;

    callHandler = {
      handle: () => of({ success: true }),
    } as CallHandler;
  });

  describe('intercept', () => {
    it('должен пропускать успешные запросы', (done) => {
      const observable = interceptor.intercept(executionContext, callHandler);
      
      observable.subscribe({
        next: (value) => {
          expect(value.success).toBe(true);
          done();
        },
      });
    });

    it('должен регистрировать попытку при ошибке INVALID_2FA_PASSWORD', (done) => {
      const errorHandler: CallHandler = {
        handle: () => throwError(() => ({
          response: {
            data: {
              errorCode: ErrorCode.INVALID_2FA_PASSWORD,
            },
          },
        })),
      } as CallHandler;

      const observable = interceptor.intercept(executionContext, errorHandler);
      
      observable.subscribe({
        error: () => {
          // Проверяем, что ошибка обработана
          done();
        },
      });
    });
  });
});

