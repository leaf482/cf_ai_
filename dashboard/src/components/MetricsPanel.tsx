'use client';

import { useCallback, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { LastSynced } from './LastSynced';
import { SIMULATION_BASE } from '@/lib/config';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts';

const MAX_POINTS = 25;

interface DataPoint {
  ts: number;
  time: string;
  rps: number;
  workerThroughput: number;
  consumerLag: number;
}

interface ChartEvent {
  type: string;
  scenarioId?: string;
  timestamp: number;
}

function slidingWindow<T>(arr: T[], item: T, max: number): T[] {
  const next = [...arr, item];
  return next.length > max ? next.slice(-max) : next;
}

function findClosestTime(data: DataPoint[], ts: number): string | undefined {
  if (data.length === 0) return undefined;
  let closest = data[0];
  let minDiff = Math.abs(data[0].ts - ts);
  for (const d of data) {
    const diff = Math.abs(d.ts - ts);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }
  return closest.time;
}

export function MetricsPanel() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [events, setEvents] = useState<ChartEvent[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/api/v1/metrics/summary`);
      const json = await res.json();
      const now = Date.now();
      const point: DataPoint = {
        ts: now,
        time: new Date(now).toLocaleTimeString(),
        rps: Number(json.rps) || 0,
        workerThroughput: Number(json.workerThroughput) || 0,
        consumerLag: Number(json.consumerLag) || 0,
      };
      setData((prev) => slidingWindow(prev, point, MAX_POINTS));
      setEvents(Array.isArray(json.events) ? json.events : []);
      setLastSyncedAt(now);
    } catch {
      // Keep previous
    }
  }, []);

  useInterval(fetchMetrics, 3000);

  const isEmpty = data.length === 0;

  return (
    <div className="relative flex h-full min-h-[280px] flex-col rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Metrics Panel
      </h2>
      <div className="flex-1 min-h-[200px]">
        {isEmpty ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-900/30">
            <p className="text-sm text-gray-500">
              Waiting for Simulation Data...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-32">
              <p className="mb-1 text-xs text-cyan-400">Throughput (API RPS vs Worker)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Legend />
                  {events
                    .filter((e) => ['start', 'spike', 'load_spike'].includes(e.type))
                    .map((e) => {
                      const x = findClosestTime(data, e.timestamp);
                      return x ? (
                        <ReferenceLine
                          key={`${e.type}-${e.timestamp}`}
                          x={x}
                          stroke={e.type === 'spike' || e.type === 'load_spike' ? '#ef4444' : '#10b981'}
                          strokeDasharray="3 3"
                          label={{
                            value: e.type === 'load_spike' ? 'Load Spike' : e.type === 'spike' ? `Spike ${e.scenarioId ?? ''}` : `Start ${e.scenarioId ?? ''}`,
                            position: 'top',
                            fill: e.type === 'spike' || e.type === 'load_spike' ? '#ef4444' : '#10b981',
                            fontSize: 9,
                          }}
                        />
                      ) : null;
                    })}
                  <Line
                    type="monotone"
                    dataKey="rps"
                    name="API RPS"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="workerThroughput"
                    name="Worker Throughput"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-24">
              <p className="mb-1 text-xs text-red-400/90">Kafka Consumer Lag</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  {events
                    .filter((e) => ['start', 'spike', 'load_spike'].includes(e.type))
                    .map((e) => {
                      const x = findClosestTime(data, e.timestamp);
                      return x ? (
                        <ReferenceLine
                          key={`lag-${e.type}-${e.timestamp}`}
                          x={x}
                          stroke={e.type === 'spike' || e.type === 'load_spike' ? '#ef4444' : '#10b981'}
                          strokeDasharray="2 2"
                        />
                      ) : null;
                    })}
                  <defs>
                    <linearGradient id="lagGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumerLag"
                    name="Consumer Lag"
                    stroke="#ef4444"
                    fill="url(#lagGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <LastSynced lastSyncedAt={lastSyncedAt} />
      </div>
    </div>
  );
}
