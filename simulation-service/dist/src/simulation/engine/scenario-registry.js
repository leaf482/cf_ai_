"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioRegistry = void 0;
function normalizeScenarioConfig(config) {
    return {
        ...config,
        heartbeatIntervalMs: config.heartbeatIntervalMs ?? 500,
        maxConcurrentSessions: config.maxConcurrentSessions ?? 20_000,
    };
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
const TEMPLATES = {
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
class ScenarioRegistry {
    scenarios = new Map();
    getAll() {
        return Array.from(this.scenarios.values());
    }
    get(id) {
        return this.scenarios.get(id);
    }
    getRunning() {
        return this.getAll().filter((s) => s.status === 'running');
    }
    has(id) {
        return this.scenarios.has(id);
    }
    createFromTemplate(templateId) {
        const t = TEMPLATES[templateId];
        if (!t)
            return undefined;
        const nowMs = Date.now();
        const scenario = {
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
    create(id, name, config) {
        const nowMs = Date.now();
        const scenario = {
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
    setStatus(id, status) {
        const s = this.scenarios.get(id);
        if (s)
            s.status = status;
    }
    setSpike(id, multiplier, durationMs) {
        const s = this.scenarios.get(id);
        if (s) {
            s.loadMultiplier = multiplier;
            s.spikeEndMs = Date.now() + durationMs;
        }
    }
    setSpikeAll(multiplier, durationMs) {
        const endMs = Date.now() + durationMs;
        for (const s of this.scenarios.values()) {
            if (s.status === 'running') {
                s.loadMultiplier = multiplier;
                s.spikeEndMs = endMs;
            }
        }
    }
    updateConfig(id, config) {
        const s = this.scenarios.get(id);
        if (s) {
            s.config = normalizeScenarioConfig({ ...s.config, ...config });
            s.elapsedTicks = 0;
            s.activeUsers = 0;
            s.startedAtMs = Date.now();
        }
    }
    recordEmitted(id, count) {
        const s = this.scenarios.get(id);
        if (s)
            s.stats.emittedEvents += count;
    }
    remove(id) {
        this.scenarios.delete(id);
    }
    listTemplates() {
        return Object.values(TEMPLATES);
    }
    getTemplate(id) {
        return TEMPLATES[id];
    }
}
exports.ScenarioRegistry = ScenarioRegistry;
//# sourceMappingURL=scenario-registry.js.map