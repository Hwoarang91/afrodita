import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('/health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiOkResponse({ description: 'Сервис доступен' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('/api')
  @ApiOperation({ summary: 'API root endpoint' })
  @ApiOkResponse({ description: 'Корневой эндпоинт API' })
  apiRoot() {
    return {
      message: 'Afrodita Massage Salon API',
      version: '1.0',
      documentation: '/api/docs',
      endpoints: {
        health: '/health',
        metrics: '/metrics',
        api: '/api/v1',
        docs: '/api/docs',
      },
    };
  }

  @Get('/api/v1')
  @ApiOperation({ summary: 'API v1 root endpoint' })
  @ApiOkResponse({ description: 'Корневой эндпоинт API v1' })
  apiV1Root() {
    return {
      message: 'Afrodita Massage Salon API v1',
      version: '1.0',
      documentation: '/api/docs',
      endpoints: {
        auth: '/api/v1/auth',
        appointments: '/api/v1/appointments',
        services: '/api/v1/services',
        masters: '/api/v1/masters',
        users: '/api/v1/users',
        health: '/health',
        metrics: '/metrics',
      },
    };
  }
}

