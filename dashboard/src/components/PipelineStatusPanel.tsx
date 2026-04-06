'use client';

import { useCallback, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { useRun } from '@/context/RunContext';
import { LastSynced } from './LastSynced';
import { SIMULATION_BASE } from '@/lib/config';

interface PipelineStep {
  id: string;
  label: string;
  status: 'active' | 'idle' | 'unknown';
}

interface WorkerMetrics {
  batchLoadAvg: number;
  batchLoadMax: number;
  processingTimeMs: number;
  totalPoints: number;
  workerStatus: 'healthy' | 'processing' | 'idle';
}

interface PipelineStatusPanelProps {
  embedded?: boolean;
}

function StatCard({
  label,
  value,
  unit,
  valueColor = 'text-gray-200',
}: {
  label: string;
  value: string | number;
  unit?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-md border border-gray-600 bg-gray-900/50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-sm ${valueColor}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs text-gray-500">{unit}</span>}
      </p>
    </div>
  );
}

export function PipelineStatusPanel({ embedded }: PipelineStatusPanelProps) {
  const { runState, refreshStatus } = useRun();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    rps: number;
    workerThroughput: number;
    lag: number;
    workerMetrics?: WorkerMetrics;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      await refreshStatus();
      const [_, metricsJson] = await Promise.all([
        refreshStatus(),
        fetch(`${SIMULATION_BASE}/api/v1/metrics/summary`).then((r) =>
          r.json().catch(() => ({}))
        ),
      ]);
      const metricsData = metricsJson;

      setPipelineStatus({
        rps: metricsData.rps ?? 0,
        workerThroughput: metricsData.workerThroughput ?? 0,
        lag: metricsData.consumerLag ?? 0,
        workerMetrics: metricsData.workerMetrics,
      });
      setLastSyncedAt(Date.now());
    } catch {
      // Keep previous
    }
  }, [refreshStatus]);

  useInterval(fetchStatus, 1000);

  const hasFlow =
    pipelineStatus &&
    (pipelineStatus.rps > 0 ||
      pipelineStatus.workerThroughput > 0 ||
      pipelineStatus.lag > 0);

  const steps: PipelineStep[] = [
    {
      id: 'api',
      label: 'API',
      status:
        hasFlow && pipelineStatus!.rps > 0
          ? 'active'
          : runState.status === 'running'
            ? 'idle'
            : 'unknown',
    },
    {
      id: 'kafka',
      label: 'Kafka',
      status: hasFlow ? 'active' : runState.status === 'running' ? 'idle' : 'unknown',
    },
    {
      id: 'worker',
      label: 'Worker',
      status:
        hasFlow && pipelineStatus!.workerThroughput > 0
          ? 'active'
          : runState.status === 'running'
            ? 'idle'
            : 'unknown',
    },
    {
      id: 'redis',
      label: 'Redis',
      status: hasFlow ? 'active' : runState.status === 'running' ? 'idle' : 'unknown',
    },
  ];

  const wm = pipelineStatus?.workerMetrics;
  const statusLabel =
    wm?.workerStatus === 'processing'
      ? 'Processing'
      : wm?.workerStatus === 'idle'
        ? 'Idle'
        : 'Healthy';

  const statusColor =
    wm?.workerStatus === 'processing'
      ? 'text-emerald-400'
      : wm?.workerStatus === 'idle'
        ? 'text-amber-400'
        : 'text-gray-400';

  return (
    <div
      className={
        embedded
          ? 'relative flex flex-1 flex-col'
          : 'relative flex flex-col rounded-lg border border-gray-700 bg-gray-800/50 p-4'
      }
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Pipeline Status
      </h2>

      {/* Pipeline Visualizer */}
      <div className="mb-4 flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${
                step.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                  : step.status === 'idle'
                    ? 'bg-gray-600/30 text-gray-400'
                    : 'bg-gray-700/30 text-gray-500'
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  step.status === 'active'
                    ? 'bg-emerald-500 animate-pulse'
                    : step.status === 'idle'
                      ? 'bg-amber-500/70'
                      : 'bg-gray-500'
                }`}
              />
              <span className="text-sm font-medium">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-cyan-500/80">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Worker Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Batch Load"
          value={
            wm
              ? `${wm.batchLoadAvg} / ${wm.batchLoadMax}`
              : '—'
          }
        />
        <StatCard
          label="Processing Time"
          value={wm?.processingTimeMs ?? '—'}
          unit="ms"
        />
        <StatCard
          label="Total Points"
          value={wm?.totalPoints ?? '—'}
        />
        <StatCard
          label="Worker Status"
          value={wm ? statusLabel : '—'}
          valueColor={statusColor}
        />
      </div>

      <div className="mt-2 flex justify-end">
        <LastSynced lastSyncedAt={lastSyncedAt} />
      </div>
    </div>
  );
}
