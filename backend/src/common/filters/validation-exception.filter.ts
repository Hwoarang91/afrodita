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
      }
    }

    response.status(status).json(exceptionResponse);
  }
}

