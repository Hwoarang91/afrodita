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

    // КРИТИЧНО: Проверяем, является ли exceptionResponse уже готовым ErrorResponse
    // Это происходит, если exceptionFactory использует buildValidationErrorResponse
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'success' in exceptionResponse &&
      'errorCode' in exceptionResponse &&
      'message' in exceptionResponse &&
      typeof (exceptionResponse as any).message === 'string' // КРИТИЧНО: message должен быть строкой
    ) {
      // Уже стандартизированный ErrorResponse от exceptionFactory
      this.logger.debug('[ValidationExceptionFilter] Получен готовый ErrorResponse от exceptionFactory');
      response.status(status).json(exceptionResponse);
      return;
    }

    // Если это ошибка ValidationPipe (массив ValidationError) - fallback для старых версий
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      
      // КРИТИЧНО: ValidationPipe создает BadRequestException с message как массив ValidationError[]
      // Структура: { statusCode: 400, message: ValidationError[], error: "Bad Request" }
      if (responseObj.message && Array.isArray(responseObj.message)) {
        this.logger.error(
          `[ValidationExceptionFilter] ValidationPipe errors detected (fallback): ${responseObj.message.length} errors`,
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
        messageType: exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? typeof (exceptionResponse as any).message
          : 'N/A',
      },
    );
    
    // КРИТИЧНО: Всегда создаем стандартизированный ErrorResponse
    // Если exceptionResponse.message - массив, используем buildValidationErrorResponse
    // Если exceptionResponse.message - строка, создаем ErrorResponse с этой строкой
    // Если exceptionResponse - строка, создаем ErrorResponse с этой строкой
    let errorResponse: any;
    
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      
      if (responseObj.message && Array.isArray(responseObj.message)) {
        // Если message - массив, преобразуем через buildValidationErrorResponse
        errorResponse = buildValidationErrorResponse(responseObj.message);
      } else if (typeof responseObj.message === 'string') {
        // Если message - строка, создаем ErrorResponse
        errorResponse = {
          success: false,
          statusCode: status,
          errorCode: 'VALIDATION_ERROR',
          message: responseObj.message,
        };
      } else {
        // Если message отсутствует или не строка/массив, создаем общий ErrorResponse
        errorResponse = {
          success: false,
          statusCode: status,
          errorCode: 'VALIDATION_ERROR',
          message: 'Ошибка валидации данных',
        };
      }
    } else if (typeof exceptionResponse === 'string') {
      // Если exceptionResponse - строка, создаем ErrorResponse
      errorResponse = {
        success: false,
        statusCode: status,
        errorCode: 'VALIDATION_ERROR',
        message: exceptionResponse,
      };
    } else {
      // Если exceptionResponse - что-то другое, создаем общий ErrorResponse
      errorResponse = {
        success: false,
        statusCode: status,
        errorCode: 'VALIDATION_ERROR',
        message: 'Ошибка валидации данных',
      };
    }
    
    // КРИТИЧНО: Всегда возвращаем стандартизированный ErrorResponse
    // НИКОГДА не возвращаем exceptionResponse напрямую
    response.status(status).json(errorResponse);
  }
}

