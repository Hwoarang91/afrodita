import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { buildValidationErrorResponse } from '../utils/error-response.builder';
import { maskSensitiveData } from '../utils/sensitive-data-masker';

/**
 * Exception filter для обработки ошибок валидации
 * Преобразует ValidationError[] в стандартизированный ErrorResponse
 * Гарантирует, что message всегда строка, а не объект или массив
 * Это предотвращает React error #31
 */
/**
 * КРИТИЧНО: Этот фильтр должен обрабатывать BadRequestException ПЕРЕД HttpExceptionFilter
 * ValidationPipe создает BadRequestException с массивом ValidationError[] в поле message
 * Этот фильтр преобразует его в стандартизированный ErrorResponse
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // КРИТИЧНО: Логируем попадание в фильтр для диагностики
    this.logger.error(
      '[ValidationExceptionFilter] HIT',
      {
        url: request.url,
        method: request.method,
        exceptionResponseType: typeof exceptionResponse,
        isArray: Array.isArray(exceptionResponse),
        hasMessage: exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse,
        messageIsArray: exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse && Array.isArray((exceptionResponse as any).message),
      },
    );

    // Логируем детали ошибки валидации с маскированием sensitive данных
    const maskedBody = maskSensitiveData(request.body || {});
    const maskedQuery = maskSensitiveData(request.query || {});
    
    this.logger.error(
      `[Validation Error] ${request.method} ${request.url}`,
      {
        status,
        errorCode: 'VALIDATION_ERROR', // Явное логирование errorCode
        exceptionResponse: typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? { ...exceptionResponse, message: '[masked]' }
          : exceptionResponse,
        body: maskedBody,
        query: maskedQuery,
      },
    );

    // Если это ошибка ValidationPipe (массив ValidationError)
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      
      // КРИТИЧНО: ValidationPipe создает BadRequestException с message как массив ValidationError[]
      // Структура: { statusCode: 400, message: ValidationError[], error: "Bad Request" }
      if (responseObj.message && Array.isArray(responseObj.message)) {
        this.logger.error(
          `[ValidationExceptionFilter] ValidationPipe errors detected: ${responseObj.message.length} errors`,
          {
            errors: responseObj.message.map((err: any) => ({
              property: err.property,
              constraints: Object.keys(err.constraints || {}),
            })),
          },
        );
        
        // Преобразуем ValidationError[] в стандартизированный ErrorResponse
        const errorResponse = buildValidationErrorResponse(responseObj.message);
        
        // КРИТИЧНО: Возвращаем стандартизированный формат
        // message всегда строка, details - массив ErrorDetail
        response.status(status).json(errorResponse);
        return;
      }
      
      // Если message уже строка, но нет стандартного формата - преобразуем
      if (typeof responseObj.message === 'string') {
        response.status(status).json({
          success: false,
          statusCode: status,
          errorCode: 'VALIDATION_ERROR',
          message: responseObj.message,
        });
        return;
      }
    }

    // КРИТИЧНО: Fallback - если дошли сюда, значит это не ValidationPipe ошибка
    // Преобразуем в стандартизированный формат для предотвращения React error #31
    this.logger.warn(
      '[ValidationExceptionFilter] Fallback: exceptionResponse не является ValidationError[]',
      {
        exceptionResponseType: typeof exceptionResponse,
        isArray: Array.isArray(exceptionResponse),
        hasMessage: exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse,
      },
    );
    
    // Преобразуем в стандартизированный ErrorResponse
    const errorResponse = buildValidationErrorResponse(
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : [exceptionResponse as any],
    );
    
    response.status(status).json(errorResponse);
  }
}

