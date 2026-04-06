export type ScenarioStatus = 'running' | 'paused' | 'stopped';
export interface ScenarioConfig {
    heartbeatIntervalMs?: number;
    maxConcurrentSessions?: number;
    baseTraffic?: {
        lambdaUsersPerSecond: number;
    };
    injection?: {
        type: 'none' | 'hot_trending' | 'viral_spike';
        targetVideoId?: string;
        totalUsers?: number;
        durationMs?: number;
    };
    videoPool: string[];
    videoPopularity?: Array<{
        videoId: string;
        weight: number;
    }>;
    zipfSkew?: number;
    watchDurationDistribution?: Array<{
        seconds: number;
        weight: number;
    }>;
    durationTicks?: number;
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
    activeUsers: number;
    sessions: Map<string, import('./user-session').UserSession>;
    userSeq: number;
    startedAtMs: number;
    loadMultiplier?: number;
    spikeEndMs?: number;
}
export interface ScenarioTemplate {
    id: string;
    name: string;
    config: ScenarioConfig;
    duration_seconds?: number;
}
export declare class ScenarioRegistry {
    private scenarios;
    getAll(): Scenario[];
    get(id: string): Scenario | undefined;
    getRunning(): Scenario[];
    has(id: string): boolean;
    createFromTemplate(templateId: string): Scenario | undefined;
    create(id: string, name: string, config: ScenarioConfig): Scenario;
    setStatus(id: string, status: ScenarioStatus): void;
    setSpike(id: string, multiplier: number, durationMs: number): void;
    setSpikeAll(multiplier: number, durationMs: number): void;
    updateConfig(id: string, config: Partial<ScenarioConfig>): void;
    recordEmitted(id: string, count: number): void;
    remove(id: string): void;
    listTemplates(): ScenarioTemplate[];
    getTemplate(id: string): ScenarioTemplate | undefined;
}
