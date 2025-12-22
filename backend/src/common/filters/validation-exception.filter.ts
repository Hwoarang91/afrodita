import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Логируем детали ошибки валидации
    this.logger.error(
      `[Validation Error] ${request.method} ${request.url}`,
      {
        status,
        exceptionResponse,
        body: request.body,
        query: request.query,
      },
    );

    // Если это ошибка ValidationPipe, логируем детали
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      if (responseObj.message && Array.isArray(responseObj.message)) {
        this.logger.error(
          `[ValidationPipe] Validation errors: ${JSON.stringify(responseObj.message)}`,
        );
        
        // Преобразуем массив ошибок в читаемое сообщение для фронтенда
        const errorMessages = responseObj.message.map((err: any) => {
          if (err.constraints) {
            return Object.values(err.constraints).join(', ');
          }
          if (typeof err === 'string') {
            return err;
          }
          return `${err.property || 'field'}: invalid value`;
        });
        
        // КРИТИЧНО: Возвращаем строку в message, а не массив объектов
        // Это предотвращает React error #31
        response.status(status).json({
          message: errorMessages.join('; '), // Строка, а не массив
          errors: responseObj.message, // Детальная информация для отладки
          error: responseObj.error || 'Bad Request',
          statusCode: responseObj.statusCode || 400,
        });
        return;
      }
    }

    response.status(status).json(exceptionResponse);
  }
}

