import { Controller, Get } from '@nestjs/common';
import { MetricsService, MetricsSummary } from './metrics.service';

@Controller('api/v1/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  async getSummary(): Promise<MetricsSummary> {
    return this.metricsService.getSummary();
  }
}
