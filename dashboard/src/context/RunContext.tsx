'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { SIMULATION_BASE } from '@/lib/config';

export type RunStatus = 'running' | 'stopped' | 'idle';

export interface RunState {
  run_id: string;
  status: RunStatus;
  paused: boolean;
  startTime: Date | null;
  sent: number;
  errors: number;
}

interface RunContextValue {
  runState: RunState;
  startSimulation: (scenarioId: string) => Promise<void>;
  stopSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  injectSpike: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const initialState: RunState = {
  run_id: '',
  status: 'idle',
  paused: false,
  startTime: null,
  sent: 0,
  errors: 0,
};

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ children }: { children: React.ReactNode }) {
  const [runState, setRunState] = useState<RunState>(initialState);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/v1/simulation/status`);
      const data = await res.json();
      setRunState((prev) => ({
        ...prev,
        run_id: data.run_id ?? prev.run_id,
        status: data.running ? 'running' : prev.run_id ? 'stopped' : 'idle',
        paused: data.paused ?? prev.paused,
        startTime: data.started_at ? new Date(data.started_at) : prev.startTime,
        sent: data.sent ?? prev.sent,
        errors: data.errors ?? prev.errors,
      }));
    } catch {
      // Keep previous state on error
    }
  }, []);

  const startSimulation = useCallback(async (scenarioId: string) => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/v1/simulation/start/${scenarioId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to start');
      setRunState({
        run_id: data.run_id ?? '',
        status: 'running',
        paused: false,
        startTime: data.started_at ? new Date(data.started_at) : new Date(),
        sent: data.sent ?? 0,
        errors: data.errors ?? 0,
      });
    } catch (err) {
      console.error('Start simulation error:', err);
      throw err;
    }
  }, []);

  const stopSimulation = useCallback(async () => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/v1/simulation/stop`, {
        method: 'POST',
      });
      const data = await res.json();
      setRunState((prev) => ({
        ...prev,
        status: 'stopped',
        paused: false,
        sent: data.sent ?? prev.sent,
        errors: data.errors ?? prev.errors,
      }));
    } catch (err) {
      console.error('Stop simulation error:', err);
    }
  }, []);

  const pauseSimulation = useCallback(async () => {
    try {
      await fetch(`${SIMULATION_BASE}/v1/simulation/pause`, { method: 'POST' });
      setRunState((prev) => ({ ...prev, paused: true }));
    } catch (err) {
      console.error('Pause error:', err);
    }
  }, []);

  const resumeSimulation = useCallback(async () => {
    try {
      await fetch(`${SIMULATION_BASE}/v1/simulation/resume`, { method: 'POST' });
      setRunState((prev) => ({ ...prev, paused: false }));
    } catch (err) {
      console.error('Resume error:', err);
    }
  }, []);

  const injectSpike = useCallback(async () => {
    try {
      await fetch(`${SIMULATION_BASE}/v1/simulation/spike`, { method: 'POST' });
    } catch (err) {
      console.error('Spike error:', err);
    }
  }, []);

  const value: RunContextValue = {
    runState,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    injectSpike,
    refreshStatus,
  };

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used within RunProvider');
  return ctx;
}
