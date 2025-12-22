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
import { buildErrorResponse } from '../utils/error-response.builder';

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

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Логируем ошибку
    this.logger.error(
      `[HTTP Exception] ${request.method} ${request.url}`,
      {
        status,
        exceptionResponse,
        body: request.body,
        query: request.query,
      },
    );

    // Если exceptionResponse уже является ErrorResponse (из ValidationExceptionFilter)
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'success' in exceptionResponse &&
      'errorCode' in exceptionResponse &&
      'message' in exceptionResponse
    ) {
      // Уже стандартизирован, возвращаем как есть
      response.status(status).json(exceptionResponse);
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
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || 'Некорректный запрос';
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

    response.status(status).json(errorResponse);
  }
}

