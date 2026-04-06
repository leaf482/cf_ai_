"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PROM_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
const LAG_THRESHOLD = 10000;
const POLL_INTERVAL_MS = 5000;
async function query(expr) {
    const url = `${PROM_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
    const res = await fetch(url);
    const json = (await res.json());
    const val = json?.data?.result?.[0]?.value?.[1];
    return val ? parseFloat(val) : 0;
}
async function main() {
    console.log(`Monitoring Kafka Consumer Lag (threshold: ${LAG_THRESHOLD})`);
    console.log('Prometheus:', PROM_URL);
    console.log('');
    let recorded = false;
    while (true) {
        try {
            const lagSum = await query('sum(kafka_consumergroup_lag_sum)');
            const lagPart = await query('sum(kafka_consumergroup_lag)');
            const lag = lagSum > 0 ? lagSum : lagPart;
            const apiRps = await query('sum(rate(api_requests_total{path="/v1/heartbeat"}[1m]))');
            const workerRps = await query('sum(rate(worker_events_processed_total[1m]))');
            const apiP95 = await query('histogram_quantile(0.95, sum(rate(api_request_duration_seconds_bucket[5m])) by (le))');
            const workerP95 = await query('histogram_quantile(0.95, sum(rate(worker_processing_duration_seconds_bucket[5m])) by (le))');
            if (lag >= LAG_THRESHOLD && !recorded) {
                recorded = true;
                console.log('--- LAG THRESHOLD EXCEEDED ---');
                console.log(`Kafka Consumer Lag: ${lag}`);
                console.log(`API RPS: ${apiRps.toFixed(2)}`);
                console.log(`Worker RPS: ${workerRps.toFixed(2)}`);
                console.log(`API P95 Latency: ${(apiP95 * 1000).toFixed(2)} ms`);
                console.log(`Worker P95 Latency: ${(workerP95 * 1000).toFixed(2)} ms`);
                console.log('-----------------------------');
            }
            if (lag > 0 || apiRps > 0) {
                process.stdout.write(`\rLag: ${lag.toFixed(0)} | API RPS: ${apiRps.toFixed(1)} | Worker RPS: ${workerRps.toFixed(1)}`);
            }
        }
        catch (e) {
            process.stdout.write(`\rError: ${e.message}    `);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
}
main();
//# sourceMappingURL=monitor-lag-threshold.js.map