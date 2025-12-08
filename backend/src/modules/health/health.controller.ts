import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('/health')
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('/api')
  @ApiOperation({ summary: 'API root endpoint - redirects to docs' })
  @Redirect('/api/docs', 301)
  apiRoot() {
    return { url: '/api/docs' };
  }

  @Get('/api/v1')
  @ApiOperation({ summary: 'API v1 root endpoint - redirects to docs' })
  @Redirect('/api/docs', 301)
  apiV1Root() {
    return { url: '/api/docs' };
  }
}

