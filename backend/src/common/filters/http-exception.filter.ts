import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse, ErrorCode, HttpExceptionResponseObject, ValidationErrorLike } from '../interfaces/error-response.interface';
import { buildErrorResponse, buildValidationErrorResponse } from '../utils/error-response.builder';
import { maskSensitiveData } from '../utils/sensitive-data-masker';
import { ErrorMetricsService } from '../utils/error-metrics.service';

function msgFromResponse(res: unknown, fallback: string): string {
  if (typeof res === 'string') return res;
  if (typeof res === 'object' && res !== null && 'message' in res) {
    const m = (res as { message?: unknown }).message;
    return typeof m === 'string' ? m : fallback;
  }
  return fallback;
}

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

    // КРИТИЧНО: ПЕРВАЯ ЗАЩИТА - проверяем на ValidationError[] в response
    // Если где-то бросили throw new BadRequestException(validationErrors)
    // то exceptionResponse.message будет массивом объектов
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as HttpExceptionResponseObject).message)
    ) {
      const arr = (exceptionResponse as HttpExceptionResponseObject).message as ValidationErrorLike[];
      this.logger.error(
        '[HttpExceptionFilter] КРИТИЧЕСКАЯ ЗАЩИТА: Обнаружен массив ValidationError[] в BadRequestException! ' +
        'Преобразуем в ErrorResponse для предотвращения React error #31.',
        {
          validationErrorsCount: arr.length,
          firstError: arr[0] ? { property: arr[0].property, constraints: Object.keys(arr[0].constraints || {}) } : null,
        },
      );

      // Преобразуем ValidationError[] в стандартизированный ErrorResponse
      const errorResponse = buildValidationErrorResponse(arr);

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
    }

    // КРИТИЧНО: ВТОРАЯ ЗАЩИТА - проверяем на ValidationError OBJECT в message
    // Если где-то бросили BadRequestException с объектом {property, constraints, value}
    // то exceptionResponse.message будет объектом (не массивом)
    const msgObj = typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
      ? (exceptionResponse as HttpExceptionResponseObject).message
      : undefined;
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      typeof msgObj === 'object' && msgObj !== null &&
      !Array.isArray(msgObj) &&
      'property' in msgObj &&
      'constraints' in msgObj
    ) {
      const ve = msgObj as ValidationErrorLike;
      this.logger.error(
        '[HttpExceptionFilter] КРИТИЧЕСКАЯ ЗАЩИТА: Обнаружен объект ValidationError в BadRequestException! ' +
        'Это вызывает React error #31. Преобразуем в ErrorResponse.',
        { validationErrorProperty: ve.property, constraints: Object.keys(ve.constraints || {}) },
      );

      // Преобразуем одиночный ValidationError в стандартизированный ErrorResponse
      const errorResponse = buildValidationErrorResponse([ve]);

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
    }



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
      typeof (exceptionResponse as HttpExceptionResponseObject).message === 'string' && // КРИТИЧНО: message должен быть строкой
      (exceptionResponse as HttpExceptionResponseObject).success === false // Дополнительная проверка на соответствие контракту
    ) {
      const o = exceptionResponse as HttpExceptionResponseObject;
      // Уже стандартизирован и соответствует контракту, возвращаем как есть
      // НО: создаем новый объект для гарантии чистоты (защита от прототипного загрязнения)
      const cleanErrorResponse: ErrorResponse = {
        success: false,
        statusCode: o.statusCode || status,
        errorCode: o.errorCode || ErrorCode.INTERNAL_SERVER_ERROR,
        message: o.message as string, // Гарантированно строка (проверено выше)
      };

      if (o.details) cleanErrorResponse.details = o.details;
      if (o.retryAfter !== undefined) cleanErrorResponse.retryAfter = o.retryAfter;

      response.status(status).json(cleanErrorResponse);
      return;
    }

    // КРИТИЧНО: ЗАЩИТА ОТ message: object (не Array, не String)
    // Если сюда пришел BadRequestException с message как объектом ValidationError
    const msgObj2 = typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
      ? (exceptionResponse as HttpExceptionResponseObject).message
      : undefined;
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      typeof msgObj2 === 'object' && msgObj2 !== null &&
      !Array.isArray(msgObj2) &&
      'property' in msgObj2 &&
      'constraints' in msgObj2
    ) {
      const ve2 = msgObj2 as ValidationErrorLike;
      this.logger.error(
        '[HttpExceptionFilter] КРИТИЧЕСКАЯ ЗАЩИТА: Обнаружен объект ValidationError в message! ' +
        'Это пропущено ValidationExceptionFilter. Преобразуем в ErrorResponse.',
        { validationErrorProperty: ve2.property, constraints: Object.keys(ve2.constraints || {}) },
      );

      const errorResponse = buildValidationErrorResponse([ve2]);

      response.status(status).json(errorResponse);
      return;
    }

    // КРИТИЧНО: Проверяем, не является ли это ValidationError[] (должно было быть обработано ValidationExceptionFilter)
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as HttpExceptionResponseObject).message)
    ) {
      this.logger.error(
        '[HttpExceptionFilter] Обнаружен массив ValidationError! ' +
        'Это должно было быть обработано ValidationExceptionFilter. ' +
        'Преобразуем в ErrorResponse для предотвращения React error #31.',
      );
      const arr2 = (exceptionResponse as HttpExceptionResponseObject).message as ValidationErrorLike[];
      const errorResponse = buildValidationErrorResponse(arr2);
      response.status(status).json(errorResponse);
      return;
    }

    // Преобразуем HttpException в стандартизированный ErrorResponse
    let errorCode: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR;
    let message: string = 'Произошла ошибка';

    // Определяем errorCode на основе статуса и сообщения
    if (status === HttpStatus.UNAUTHORIZED) {
      errorCode = ErrorCode.UNAUTHORIZED;
      message = msgFromResponse(exceptionResponse, 'Требуется авторизация');
    } else if (status === HttpStatus.FORBIDDEN) {
      errorCode = ErrorCode.UNAUTHORIZED; // Используем UNAUTHORIZED для 403 тоже
      message = msgFromResponse(exceptionResponse, 'Доступ запрещен');
    } else if (status === HttpStatus.NOT_FOUND) {
      errorCode = ErrorCode.NOT_FOUND;
      message = msgFromResponse(exceptionResponse, 'Ресурс не найден');
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      errorCode = ErrorCode.TOO_MANY_REQUESTS;
      message = msgFromResponse(exceptionResponse, 'Слишком много запросов');
    } else if (status === HttpStatus.BAD_REQUEST) {
      errorCode = ErrorCode.VALIDATION_ERROR;
      
      // КРИТИЧНО: Проверяем, не является ли message массивом ValidationError
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as HttpExceptionResponseObject;
        
        // Если message - массив ValidationError, преобразуем в ErrorResponse
        if (Array.isArray(responseObj.message)) {
          const arr3 = responseObj.message as ValidationErrorLike[];
          this.logger.error(
            '[HttpExceptionFilter] Обнаружен массив ValidationError в BAD_REQUEST! ' +
            'Это должно было быть обработано ValidationExceptionFilter. ' +
            'Преобразуем в ErrorResponse для предотвращения React error #31.',
            {
              validationErrorsCount: arr3.length,
              firstError: arr3[0] ? { property: arr3[0].property, constraints: Object.keys(arr3[0].constraints || {}) } : null,
            },
          );
          const errorResponse = buildValidationErrorResponse(arr3);
          
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
          // КРИТИЧНО: Если message не строка и не массив, используем fallback
          // Это защита от случаев, когда где-то создается HttpException с объектом в message
          this.logger.warn(
            '[HttpExceptionFilter] Обнаружен объект в message (не массив и не строка)! ' +
            'Используем fallback для предотвращения React error #31.',
            {
              messageType: typeof responseObj.message,
              messageValue: responseObj.message,
            },
          );
          message = 'Некорректный запрос';
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = 'Некорректный запрос';
      }
    } else {
      // Для остальных статусов используем общий код
      message = msgFromResponse(exceptionResponse, exception.message || 'Внутренняя ошибка сервера');
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

