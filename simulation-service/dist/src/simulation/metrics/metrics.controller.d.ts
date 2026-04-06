import { MetricsService, MetricsSummary } from './metrics.service';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    getSummary(): Promise<MetricsSummary>;
}
