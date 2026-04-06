"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const event_log_service_1 = require("../events/event-log.service");
const PROM_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
const CACHE_TTL_MS = 2000;
let MetricsService = MetricsService_1 = class MetricsService {
    eventLog;
    logger = new common_1.Logger(MetricsService_1.name);
    cache = null;
    cacheExpiry = 0;
    constructor(eventLog) {
        this.eventLog = eventLog;
    }
    async getSummary() {
        const now = Date.now();
        if (this.cache && now < this.cacheExpiry) {
            return this.cache;
        }
        try {
            const [rps, workerThroughput, consumerLag, eventsRate, batchCountRate, processingSumRate, totalPoints,] = await Promise.all([
                this.queryPrometheus('sum(rate(api_requests_total{path="/v1/heartbeat"}[1m]))'),
                this.queryPrometheus('sum(rate(worker_events_processed_total[1m]))'),
                this.queryPrometheus('sum(kafka_consumergroup_lag_sum)').catch(() => this.queryPrometheus('sum(kafka_consumergroup_lag)')),
                this.queryPrometheus('sum(rate(worker_events_processed_total[1m]))'),
                this.queryPrometheus('sum(rate(worker_processing_duration_seconds_count[1m]))'),
                this.queryPrometheus('sum(rate(worker_processing_duration_seconds_sum[1m]))'),
                this.queryPrometheus('sum(worker_ranking_updates_total)'),
            ]);
            const events = this.eventLog
                .getEvents(5 * 60 * 1000)
                .map((e) => ({
                type: e.type,
                scenarioId: e.scenarioId,
                timestamp: e.timestamp,
            }));
            const batchLoadAvg = batchCountRate > 0 ? eventsRate / batchCountRate : 0;
            const processingTimeMs = batchCountRate > 0 ? (processingSumRate / batchCountRate) * 1000 : 0;
            const workerStatus = workerThroughput > 0
                ? 'processing'
                : rps > 0 || consumerLag > 0
                    ? 'idle'
                    : 'healthy';
            const summary = {
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
        }
        catch (err) {
            this.logger.warn(`Prometheus query failed: ${err instanceof Error ? err.message : String(err)}`);
            return {
                rps: 0,
                workerThroughput: 0,
                consumerLag: 0,
                fetchedAt: now,
                events: this.eventLog
                    .getEvents(5 * 60 * 1000)
                    .map((e) => ({
                    type: e.type,
                    scenarioId: e.scenarioId,
                    timestamp: e.timestamp,
                })),
                workerMetrics: {
                    batchLoadAvg: 0,
                    batchLoadMax: 50,
                    processingTimeMs: 0,
                    totalPoints: 0,
                    workerStatus: 'healthy',
                },
            };
        }
    }
    async queryPrometheus(expr) {
        const url = `${PROM_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
        const res = await fetch(url);
        const json = (await res.json());
        const val = json?.data?.result?.[0]?.value?.[1];
        return val ? parseFloat(val) : 0;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = MetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [event_log_service_1.EventLogService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map