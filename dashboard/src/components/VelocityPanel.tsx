 'use client';

import { useCallback, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { GO_API_BASE } from '@/lib/config';
import { getVideoTitle } from '@/lib/videos';
import { LastSynced } from './LastSynced';
 
interface TrendingItem {
  video_id: string;
  velocity: number;
}

const LIMIT = 10;

export function VelocityPanel() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(
        `${GO_API_BASE}/v1/ranking/trending?limit=${LIMIT}`,
        {
          cache: 'no-store',
        },
      );
      const json = await res.json();
      const rows = Array.isArray(json) ? json : [];
      const normalized: TrendingItem[] = rows.map(
        (row: {
          video_id?: string;
          velocity?: number;
          score?: number;
          VideoID?: string;
          Velocity?: number;
          Score?: number;
        }) => ({
          video_id: row.video_id ?? row.VideoID ?? '',
          // Back-compat: older payloads used "score" as velocity.
          velocity: Number(row.velocity ?? row.Velocity ?? row.score ?? row.Score ?? 0),
        }),
      );
      setItems(normalized);
      setLastSyncedAt(Date.now());
    } catch {
      setItems([]);
    }
  }, []);

  useInterval(fetchTrending, 1000);

  const max = Math.max(
    1,
    ...items.map((i) => Math.round(i.velocity)),
  );

  return (
    <div className="relative flex h-full min-h-[280px] flex-col rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Velocity Visualization
      </h2>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-900/30">
          <p className="text-sm text-gray-500">Waiting for Trending Data...</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
          {items.map((it) => {
            const v = Math.round(it.velocity);
            const pct = Math.max(0, Math.min(1, v / max));
            return (
              <div
                key={it.video_id}
                className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2"
              >
                <span className="truncate font-mono text-xs text-gray-300">
                  {getVideoTitle(it.video_id)}
                </span>
                <div className="h-2 overflow-hidden rounded bg-gray-700">
                  <div
                    className="h-full rounded bg-cyan-500/80"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs tabular-nums text-gray-400">
                  {v}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <LastSynced lastSyncedAt={lastSyncedAt} />
      </div>
    </div>
  );
}

