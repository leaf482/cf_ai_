/**
 * Load Test preset phases (step-up).
 * Phase 1: 100 users × 2 min
 * Phase 2: 300 users × 2 min
 * Phase 3: 500 users × 2 min
 * Phase 4: 1000 users × 10 min
 */

import { SimulationScenario } from '../interfaces/scenario.interface';

const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);

export interface LoadTestPhase {
  name: string;
  users: number;
  duration_seconds: number;
}

export const LOAD_TEST_PHASES: LoadTestPhase[] = [
  { name: 'Phase 1', users: 100, duration_seconds: 120 },
  { name: 'Phase 2', users: 300, duration_seconds: 120 },
  { name: 'Phase 3', users: 500, duration_seconds: 120 },
  { name: 'Phase 4 (limit)', users: 1000, duration_seconds: 600 },
];

const COOLDOWN_MS = 3000;

export function phaseToScenario(phase: LoadTestPhase): SimulationScenario {
  return {
    name: phase.name,
    type: 'normal',
    users: phase.users,
    video_ids: [...DEFAULT_VIDEO_IDS],
    watch_seconds: 30,
    ramp_up_seconds: 10,
    events_per_second: 1,
    duration_seconds: phase.duration_seconds,
  };
}

export function getPhaseDurationMs(phase: LoadTestPhase): number {
  return phase.duration_seconds * 1000;
}

export { COOLDOWN_MS };
