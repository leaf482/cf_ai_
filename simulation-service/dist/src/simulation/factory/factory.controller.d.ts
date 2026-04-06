import { FactoryService } from './factory.service';
export interface CreateScenarioDto {
    name?: string;
    presetId?: string;
    users?: number;
    targetVideoId?: string;
    watchSeconds?: number;
    intervalMs?: number;
    durationSeconds?: number;
}
export interface PatchScenarioDto {
    action: 'pause' | 'resume' | 'spike' | 'stop';
}
export declare class FactoryController {
    private readonly factoryService;
    constructor(factoryService: FactoryService);
    create(dto: CreateScenarioDto): {
        id: string;
        name: string;
        config: import("../server").ScenarioConfig;
        message: string;
    };
    list(): {
        id: string;
        name: string;
        status: import("../server").ScenarioStatus;
        config: import("../server").ScenarioConfig;
        stats: {
            emittedEvents: number;
            activeUsers: number;
            elapsedTicks: number;
        };
    }[];
    getAttribution(): Record<string, string[]>;
    getAttributionDetail(): Record<string, {
        scenarioId: string;
        scenarioName: string;
        emittedCount: number;
        activeViewers: number;
        hps: number;
    }[]>;
    patch(id: string, dto: PatchScenarioDto): {
        id: string;
        action: string;
    };
}
