import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/metrics')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Prometheus metrics (text/plain)' })
  async getMetrics(): Promise<string> {
    return this.metricsService.getContent();
  }
}
