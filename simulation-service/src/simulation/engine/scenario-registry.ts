/**
 * Simulation Factory - Scenario Registry
 * Manages multiple scenarios in memory with Map<string, Scenario>.
 */

export type ScenarioStatus = 'running' | 'paused' | 'stopped';

export interface ScenarioConfig {
  /**
   * Heartbeat cadence per active user session.
   * If omitted, defaults to 500ms.
   */
  heartbeatIntervalMs?: number;

  /**
   * Guardrail to prevent session explosion.
   * If omitted, defaults to 20,000 concurrent sessions per scenario.
   */
  maxConcurrentSessions?: number;

  /**
   * Base traffic model (continuous arrivals).
   * Each second we sample usersPerSecond ~ Poisson(lambdaUsersPerSecond).
   */
  baseTraffic?: {
    lambdaUsersPerSecond: number;
  };

  /**
   * Scenario injection model (additional user groups beyond base traffic).
   * Injection timing/shape is handled by the tick scheduler.
   */
  injection?: {
    type: 'none' | 'hot_trending' | 'viral_spike';
    /** For injections that target one video strongly */
    targetVideoId?: string;
    /** Approx total users to inject over the injection window */
    totalUsers?: number;
    /** Duration window (ms) during which to inject */
    durationMs?: number;
  };

  /**
   * Video pool used by weighted selection.
   * Order matters: earlier items are treated as more popular.
   */
  videoPool: string[];

  /**
   * Optional explicit popularity weights for videos.
   * When provided (non-empty), this overrides Zipf selection and uses
   * weighted random choice across these entries.
   */
  videoPopularity?: Array<{ videoId: string; weight: number }>;

  /** Zipf skew for weighted video selection. Higher = more head-heavy. */
  zipfSkew?: number;

  /**
   * Watch duration distribution.
   * If omitted, defaults to: 50%→3s, 30%→10s, 15%→30s, 5%→60s
   */
  watchDurationDistribution?: Array<{ seconds: number; weight: number }>;

  /** Optional duration in ticks (100ms each). When reached, scenario stops. */
  durationTicks?: number;
}

function normalizeScenarioConfig(config: ScenarioConfig): ScenarioConfig {
  return {
    ...config,
    heartbeatIntervalMs: config.heartbeatIntervalMs ?? 500,
    maxConcurrentSessions: config.maxConcurrentSessions ?? 20_000,
  };
}

export interface ScenarioStats {
  emittedEvents: number;
}

export interface Scenario {
  id: string;
  name: string;
  status: ScenarioStatus;
  config: ScenarioConfig;
  stats: ScenarioStats;
  elapsedTicks: number;
  /** Active concurrent sessions */
  activeUsers: number;
  /** Active sessions keyed by userId */
  sessions: Map<string, import('./user-session').UserSession>;
  /** For generating distinct user IDs per scenario */
  userSeq: number;
  /** Scenario start time (ms) for injection timing */
  startedAtMs: number;
  /** Chaos: temporary load multiplier (e.g. 5 for 5x spike) */
  loadMultiplier?: number;
  /** When loadMultiplier expires (Unix ms) */
  spikeEndMs?: number;
}

/** Template for creating scenarios (presets) */
export interface ScenarioTemplate {
  id: string;
  name: string;
  config: ScenarioConfig;
  duration_seconds?: number;
}

const DEFAULT_VIDEO_IDS = [
  'MrBeast Challenge',
  'Street Interview',
  "Life Hack: Don't",
  'GRWM for Prom',
  'Golden Retriever',
  'Restocking My Fridge',
  'Day in my Life',
  "POV: You're Late",
  'I Won 10,000$',
  'Is it Cake?',
];

const TEMPLATES: Record<string, ScenarioTemplate> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 50 },
      injection: { type: 'none' },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.1,
    },
    duration_seconds: 120,
  },
  normal_300: {
    id: 'normal_300',
    name: 'Normal (300 users)',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 150 },
      injection: { type: 'none' },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.1,
    },
    duration_seconds: 120,
  },
  normal_500: {
    id: 'normal_500',
    name: 'Normal (500 users)',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 250 },
      injection: { type: 'none' },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.1,
    },
    duration_seconds: 120,
  },
  spike: {
    id: 'spike',
    name: 'Spike',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 50 },
      injection: { type: 'viral_spike', totalUsers: 5000, durationMs: 5000 },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.2,
    },
    duration_seconds: 180,
  },
  slowdown: {
    id: 'slowdown',
    name: 'Slowdown',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 50 },
      injection: { type: 'none' },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.1,
    },
    duration_seconds: 120,
  },
  load_test: {
    id: 'load_test',
    name: 'Load Test (100→300→500→1000)',
    config: {
      baseTraffic: { lambdaUsersPerSecond: 50 },
      injection: { type: 'none' },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.1,
    },
    duration_seconds: 600,
  },
};

export class ScenarioRegistry {
  private scenarios = new Map<string, Scenario>();

  getAll(): Scenario[] {
    return Array.from(this.scenarios.values());
  }

  get(id: string): Scenario | undefined {
    return this.scenarios.get(id);
  }

  getRunning(): Scenario[] {
    return this.getAll().filter((s) => s.status === 'running');
  }

  has(id: string): boolean {
    return this.scenarios.has(id);
  }

  createFromTemplate(templateId: string): Scenario | undefined {
    const t = TEMPLATES[templateId];
    if (!t) return undefined;

    const nowMs = Date.now();
    const scenario: Scenario = {
      id: t.id,
      name: t.name,
      status: 'running',
      config: normalizeScenarioConfig({ ...t.config }),
      stats: { emittedEvents: 0 },
      elapsedTicks: 0,
      activeUsers: 0,
      sessions: new Map(),
      userSeq: 0,
      startedAtMs: nowMs,
    };
    this.scenarios.set(t.id, scenario);
    return scenario;
  }

  create(id: string, name: string, config: ScenarioConfig): Scenario {
    const nowMs = Date.now();
    const scenario: Scenario = {
      id,
      name,
      status: 'running',
      config: normalizeScenarioConfig({ ...config }),
      stats: { emittedEvents: 0 },
      elapsedTicks: 0,
      activeUsers: 0,
      sessions: new Map(),
      userSeq: 0,
      startedAtMs: nowMs,
    };
    this.scenarios.set(id, scenario);
    return scenario;
  }

  setStatus(id: string, status: ScenarioStatus): void {
    const s = this.scenarios.get(id);
    if (s) s.status = status;
  }

  /** Apply load spike to scenario for durationMs */
  setSpike(id: string, multiplier: number, durationMs: number): void {
    const s = this.scenarios.get(id);
    if (s) {
      s.loadMultiplier = multiplier;
      s.spikeEndMs = Date.now() + durationMs;
    }
  }

  /** Apply load spike to all running scenarios */
  setSpikeAll(multiplier: number, durationMs: number): void {
    const endMs = Date.now() + durationMs;
    for (const s of this.scenarios.values()) {
      if (s.status === 'running') {
        s.loadMultiplier = multiplier;
        s.spikeEndMs = endMs;
      }
    }
  }

  /** Update config (e.g. load_test phase switch) without resetting stats */
  updateConfig(id: string, config: Partial<ScenarioConfig>): void {
    const s = this.scenarios.get(id);
    if (s) {
      s.config = normalizeScenarioConfig({ ...s.config, ...config });
      s.elapsedTicks = 0;
      s.activeUsers = 0;
      s.startedAtMs = Date.now();
    }
  }

  recordEmitted(id: string, count: number): void {
    const s = this.scenarios.get(id);
    if (s) s.stats.emittedEvents += count;
  }

  remove(id: string): void {
    this.scenarios.delete(id);
  }

  listTemplates(): ScenarioTemplate[] {
    return Object.values(TEMPLATES);
  }

  getTemplate(id: string): ScenarioTemplate | undefined {
    return TEMPLATES[id];
  }
}
