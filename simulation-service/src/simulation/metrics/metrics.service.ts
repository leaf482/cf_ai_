/**
 * BFF Metrics Service: Queries Prometheus for summarized metrics.
 * 2-second cache for frontend optimization.
 * Includes scenario event timestamps for chart annotations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventLogService, ScenarioEvent } from '../events/event-log.service';

const PROM_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
const CACHE_TTL_MS = 2000;

export interface MetricsSummary {
  rps: number;
  workerThroughput: number;
  consumerLag: number;
  fetchedAt: number;
  /** Event timestamps for chart annotations (last 5 min) */
  events: Array<{ type: string; scenarioId?: string; timestamp: number }>;
  /** Worker performance metrics */
  workerMetrics?: {
    batchLoadAvg: number;
    batchLoadMax: number;
    processingTimeMs: number;
    totalPoints: number;
    workerStatus: 'healthy' | 'processing' | 'idle';
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cache: MetricsSummary | null = null;
  private cacheExpiry = 0;

  constructor(private readonly eventLog: EventLogService) {}

  async getSummary(): Promise<MetricsSummary> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const [
        rps,
        workerThroughput,
        consumerLag,
        eventsRate,
        batchCountRate,
        processingSumRate,
        totalPoints,
      ] = await Promise.all([
        this.queryPrometheus(
          'sum(rate(api_requests_total{path="/v1/heartbeat"}[1m]))',
        ),
        this.queryPrometheus('sum(rate(worker_events_processed_total[1m]))'),
        this.queryPrometheus('sum(kafka_consumergroup_lag_sum)').catch(() =>
          this.queryPrometheus('sum(kafka_consumergroup_lag)'),
        ),
        this.queryPrometheus('sum(rate(worker_events_processed_total[1m]))'),
        this.queryPrometheus(
          'sum(rate(worker_processing_duration_seconds_count[1m]))',
        ),
        this.queryPrometheus(
          'sum(rate(worker_processing_duration_seconds_sum[1m]))',
        ),
        this.queryPrometheus('sum(worker_ranking_updates_total)'),
      ]);

      const events = this.eventLog
        .getEvents(5 * 60 * 1000)
        .map((e: ScenarioEvent) => ({
          type: e.type,
          scenarioId: e.scenarioId,
          timestamp: e.timestamp,
        }));

      const batchLoadAvg = batchCountRate > 0 ? eventsRate / batchCountRate : 0;
      const processingTimeMs =
        batchCountRate > 0 ? (processingSumRate / batchCountRate) * 1000 : 0;

      const workerStatus: 'healthy' | 'processing' | 'idle' =
        workerThroughput > 0
          ? 'processing'
          : rps > 0 || consumerLag > 0
            ? 'idle'
            : 'healthy';

      const summary: MetricsSummary = {
        rps: Math.round(rps * 100) / 100,
        workerThroughput: Math.round(workerThroughput * 100) / 100,
        consumerLag: Math.round(consumerLag),
        fetchedAt: now,
        events,
        workerMetrics: {
          batchLoadAvg: Math.round(batchLoadAvg * 10) / 10,
          batchLoadMax: 50,
          processingTimeMs: Math.round(processingTimeMs * 10) / 10,
          totalPoints: Math.round(totalPoints),
          workerStatus,
        },
      };

      this.cache = summary;
      this.cacheExpiry = now + CACHE_TTL_MS;
      return summary;
    } catch (err) {
      this.logger.warn(
        `Prometheus query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        rps: 0,
        workerThroughput: 0,
        consumerLag: 0,
        fetchedAt: now,
        events: this.eventLog
          .getEvents(5 * 60 * 1000)
          .map((e: ScenarioEvent) => ({
            type: e.type,
            scenarioId: e.scenarioId,
            timestamp: e.timestamp,
          })),
        workerMetrics: {
          batchLoadAvg: 0,
          batchLoadMax: 50,
          processingTimeMs: 0,
          totalPoints: 0,
          workerStatus: 'healthy' as const,
        },
      };
    }
  }

  private async queryPrometheus(expr: string): Promise<number> {
    const url = `${PROM_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: { result?: { value?: [number, string] }[] };
    };
    const val = json?.data?.result?.[0]?.value?.[1];
    return val ? parseFloat(val) : 0;
  }
}
