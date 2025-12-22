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
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

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
      
      // Проверяем, является ли message массивом ValidationError
      if (responseObj.message && Array.isArray(responseObj.message)) {
        this.logger.error(
          `[ValidationPipe] Validation errors: ${JSON.stringify(responseObj.message)}`,
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

    // Fallback: возвращаем как есть (для совместимости)
    response.status(status).json(exceptionResponse);
  }
}

