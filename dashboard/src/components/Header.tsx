'use client';

import { useRun } from '@/context/RunContext';

export function Header() {
  const { runState } = useRun();

  const statusColor =
    runState.status === 'running'
      ? runState.paused
        ? 'text-amber-400'
        : 'text-emerald-400'
      : runState.status === 'stopped'
        ? 'text-amber-400'
        : 'text-gray-500';

  const statusLabel =
    runState.status === 'running' && runState.paused
      ? 'Paused'
      : runState.status.charAt(0).toUpperCase() + runState.status.slice(1);

  return (
    <header className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-600/80 font-bold text-white">
          R
        </div>
        <span className="text-lg font-semibold text-gray-100">
          Ranking Engine Monitor
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2">
          <span className="text-sm text-gray-400">Run ID:</span>
          <span className="font-mono font-medium text-emerald-400">
            {runState.run_id || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2">
          <span className="text-sm text-gray-400">Status:</span>
          <span className={`font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
