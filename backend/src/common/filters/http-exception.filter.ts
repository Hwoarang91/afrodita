import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse, ErrorCode } from '../interfaces/error-response.interface';
import { buildErrorResponse, buildValidationErrorResponse } from '../utils/error-response.builder';
import { getHttpStatusForErrorCode } from '../utils/error-code-http-map';
import { maskSensitiveData } from '../utils/sensitive-data-masker';
import { ErrorMetricsService } from '../utils/error-metrics.service';

/**
 * Глобальный exception filter для всех HttpException
 * Преобразует все HTTP исключения в стандартизированный ErrorResponse контракт
 * Это гарантирует, что UI всегда получает единый формат ошибок
 * 
 * НЕ обрабатывает ValidationException (это делает ValidationExceptionFilter)
 * НЕ обрабатывает неизвестные исключения (это делает AllExceptionsFilter)
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  public errorMetricsService: ErrorMetricsService | null = null;

  // Используем опциональную инъекцию через ModuleRef для избежания circular dependencies
  setErrorMetricsService(service: ErrorMetricsService): void {
    this.errorMetricsService = service;
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Логируем ошибку с маскированием sensitive данных
    // КРИТИЧНО: Логируем errorCode, а не message (message для UI)
    const maskedBody = maskSensitiveData(request.body || {});
    const maskedQuery = maskSensitiveData(request.query || {});
    
    this.logger.error(
      `[HTTP Exception] ${request.method} ${request.url}`,
      {
        status,
        exceptionResponse: typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? { ...exceptionResponse, message: '[masked]' }
          : exceptionResponse,
        body: maskedBody,
        query: maskedQuery,
      },
    );

    // КРИТИЧНО: Проверяем, является ли exceptionResponse уже стандартизированным ErrorResponse
    // НО: даже если это ErrorResponse, мы должны убедиться, что message - строка
    // и что нет лишних полей, которые могут нарушить контракт
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'success' in exceptionResponse &&
      'errorCode' in exceptionResponse &&
      'message' in exceptionResponse &&
      typeof (exceptionResponse as any).message === 'string' && // КРИТИЧНО: message должен быть строкой
      (exceptionResponse as any).success === false // Дополнительная проверка на соответствие контракту
    ) {
      // Уже стандартизирован и соответствует контракту, возвращаем как есть
      // НО: создаем новый объект для гарантии чистоты (защита от прототипного загрязнения)
      const cleanErrorResponse: ErrorResponse = {
        success: false,
        statusCode: (exceptionResponse as any).statusCode || status,
        errorCode: (exceptionResponse as any).errorCode,
        message: (exceptionResponse as any).message, // Гарантированно строка
      };
      
      if ((exceptionResponse as any).details) {
        cleanErrorResponse.details = (exceptionResponse as any).details;
      }
      
      if ((exceptionResponse as any).retryAfter !== undefined) {
        cleanErrorResponse.retryAfter = (exceptionResponse as any).retryAfter;
      }
      
      response.status(status).json(cleanErrorResponse);
      return;
    }

    // КРИТИЧНО: Проверяем, не является ли это ValidationError[] (должно было быть обработано ValidationExceptionFilter)
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message)
    ) {
      this.logger.error(
        '[HttpExceptionFilter] Обнаружен массив ValidationError! ' +
        'Это должно было быть обработано ValidationExceptionFilter. ' +
        'Преобразуем в ErrorResponse для предотвращения React error #31.',
      );
      
      // Преобразуем ValidationError[] в стандартизированный ErrorResponse
      const validationErrors = (exceptionResponse as any).message;
      const errorResponse = buildValidationErrorResponse(validationErrors);
      response.status(status).json(errorResponse);
      return;
    }

    // Преобразуем HttpException в стандартизированный ErrorResponse
    let errorCode: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR;
    let message: string = 'Произошла ошибка';

    // Определяем errorCode на основе статуса и сообщения
    if (status === HttpStatus.UNAUTHORIZED) {
      errorCode = ErrorCode.UNAUTHORIZED;
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any)?.message || 'Требуется авторизация';
    } else if (status === HttpStatus.FORBIDDEN) {
      errorCode = ErrorCode.UNAUTHORIZED; // Используем UNAUTHORIZED для 403 тоже
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || 'Доступ запрещен';
    } else if (status === HttpStatus.NOT_FOUND) {
      errorCode = ErrorCode.NOT_FOUND;
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || 'Ресурс не найден';
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      errorCode = ErrorCode.TOO_MANY_REQUESTS;
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || 'Слишком много запросов';
    } else if (status === HttpStatus.BAD_REQUEST) {
      errorCode = ErrorCode.VALIDATION_ERROR;
      
      // КРИТИЧНО: Проверяем, не является ли message массивом ValidationError
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        
        // Если message - массив ValidationError, преобразуем в ErrorResponse
        if (Array.isArray(responseObj.message)) {
          this.logger.error(
            '[HttpExceptionFilter] Обнаружен массив ValidationError в BAD_REQUEST! ' +
            'Это должно было быть обработано ValidationExceptionFilter. ' +
            'Преобразуем в ErrorResponse для предотвращения React error #31.',
            {
              validationErrorsCount: responseObj.message.length,
              firstError: responseObj.message[0] ? {
                property: responseObj.message[0].property,
                constraints: Object.keys(responseObj.message[0].constraints || {}),
              } : null,
            },
          );
          
          // Преобразуем ValidationError[] в стандартизированный ErrorResponse
          const validationErrors = responseObj.message;
          const errorResponse = buildValidationErrorResponse(validationErrors);
          
          // Регистрируем ошибку в метриках
          if (this.errorMetricsService) {
            this.errorMetricsService.recordError(ErrorCode.VALIDATION_ERROR, {
              statusCode: status,
              url: request.url,
              method: request.method,
            });
          }
          
          response.status(status).json(errorResponse);
          return;
        } else if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else {
          message = 'Некорректный запрос';
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = 'Некорректный запрос';
      }
    } else {
      // Для остальных статусов используем общий код
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || exception.message || 'Внутренняя ошибка сервера';
    }

    // Создаем стандартизированный ErrorResponse
    const errorResponse = buildErrorResponse(
      status,
      errorCode,
      message,
    );

    // Регистрируем ошибку в метриках (если сервис доступен)
    // Это включает canary-алерты для Telegram деградаций
    if (this.errorMetricsService) {
      this.errorMetricsService.recordError(errorCode, {
        statusCode: status,
        url: request.url,
        method: request.method,
        sessionId: request.user?.sessionId, // Если доступно
      });
    }

    response.status(status).json(errorResponse);
  }
}

