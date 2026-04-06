'use client';

import { useEffect, useState, useCallback } from 'react';
import { SIMULATION_BASE } from '@/lib/config';
import { VIDEO_IDS, getVideoTitle } from '@/lib/videos';

interface ScenarioPreset {
  id: string;
  name: string;
  description?: string;
  users: number;
  watchSeconds: number;
  intervalMs: number;
  durationSeconds?: number;
  scoreIncreases?: boolean;
}

interface ActiveScenario {
  id: string;
  name: string;
  status: string;
  config: { targetVideoId: string };
}

export function ControlPanel() {
  const [presets, setPresets] = useState<ScenarioPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('regular');
  const [targetVideoId, setTargetVideoId] = useState('video1');
  const [intervalMs, setIntervalMs] = useState<number | ''>(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeScenarios, setActiveScenarios] = useState<ActiveScenario[]>([]);
  const [lastDeployed, setLastDeployed] = useState<{ name: string; videoId: string } | null>(null);

  useEffect(() => {
    fetch(`${SIMULATION_BASE}/v1/factory/presets`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPresets(list);
        if (list.length > 0 && !selectedPresetId) {
          setSelectedPresetId(list[0].id);
          setIntervalMs(list[0].intervalMs);
        }
      })
      .catch(() => setPresets([]));
  }, []);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  useEffect(() => {
    const p = presets.find((x) => x.id === selectedPresetId);
    if (p) setIntervalMs(p.intervalMs);
  }, [selectedPresetId, presets]);

  const fetchActiveScenarios = useCallback(async () => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/v1/factory/scenarios`);
      const json = await res.json();
      setActiveScenarios(Array.isArray(json) ? json : []);
    } catch {
      setActiveScenarios([]);
    }
  }, []);

  useEffect(() => {
    fetchActiveScenarios();
    const id = setInterval(fetchActiveScenarios, 2000);
    return () => clearInterval(id);
  }, [fetchActiveScenarios]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleDeploy = async () => {
    if (!selectedPreset) {
      setError('Select a preset');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const dto = {
        presetId: selectedPresetId,
        targetVideoId: targetVideoId || 'video1',
        intervalMs: intervalMs === '' ? selectedPreset.intervalMs : Number(intervalMs),
      };
      const res = await fetch(`${SIMULATION_BASE}/v1/factory/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      setLastDeployed({ name: selectedPreset.name, videoId: targetVideoId });
      fetchActiveScenarios();
      showSuccess('Scenario Deployed & Started!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Preset</label>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="min-w-[160px] rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {presets.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (λ ≈ {p.users}/s)
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Target Video</label>
            <select
              value={targetVideoId}
              onChange={(e) => setTargetVideoId(e.target.value)}
              className="min-w-[140px] rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {VIDEO_IDS.map((id) => (
                <option key={id} value={id}>
                  {getVideoTitle(id)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Heartbeat Interval (ms)</label>
            <input
              type="number"
              min={100}
              value={intervalMs}
              onChange={(e) =>
                setIntervalMs(e.target.value === '' ? '' : Number(e.target.value) || 500)
              }
              className="w-24 rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={handleDeploy}
            disabled={loading || !selectedPreset}
            className="rounded bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Deploying...' : 'Deploy'}
          </button>
        </div>

        {selectedPreset && (
          <div className="text-xs text-gray-400 max-w-xs">
            <div className="font-semibold text-gray-300">{selectedPreset.name}</div>
            <div>
              λ ≈ {selectedPreset.users}/s arrivals · watch duration ~{selectedPreset.watchSeconds}
              s · heartbeat interval {selectedPreset.intervalMs}ms
            </div>
          </div>
        )}

        {/* Live Status */}
        <div className="flex items-center gap-3">
          {successMessage && (
            <span className="rounded bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-400">
              {successMessage}
            </span>
          )}
          <div className="rounded border border-gray-600 bg-gray-900/50 px-3 py-1.5">
            <span className="text-xs text-gray-500">Live: </span>
            {activeScenarios.length > 0 ? (
              <span className="text-sm text-emerald-400">
                {activeScenarios.length} running
                {lastDeployed && (
                  <span className="ml-1.5 text-gray-400">
                    ({lastDeployed.name} → {getVideoTitle(lastDeployed.videoId)})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-sm text-gray-500">—</span>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
