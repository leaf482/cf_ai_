import { ScenarioConfig } from '../engine/scenario-registry';
import { MasterTickScheduler } from '../engine/master-tick-scheduler';
import { ScenarioRegistry } from '../engine/scenario-registry';
import { AttributionIndex } from '../engine/attribution-index';
import { EventLogService } from '../events/event-log.service';
import type { CreateScenarioDto } from './factory.controller';
export declare class FactoryService {
    private readonly scheduler;
    private readonly registry;
    private readonly attributionIndex;
    private readonly eventLog;
    constructor(scheduler: MasterTickScheduler, registry: ScenarioRegistry, attributionIndex: AttributionIndex, eventLog: EventLogService);
    createAndStart(dto: CreateScenarioDto): {
        id: string;
        name: string;
        config: ScenarioConfig;
        message: string;
    };
    listActive(): {
        id: string;
        name: string;
        status: import("../engine/scenario-registry").ScenarioStatus;
        config: ScenarioConfig;
        stats: {
            emittedEvents: number;
            activeUsers: number;
            elapsedTicks: number;
        };
    }[];
    patchScenario(id: string, action: 'pause' | 'resume' | 'spike' | 'stop'): {
        id: string;
        action: string;
    };
    getAttribution(): Record<string, string[]>;
    getAttributionDetail(): Record<string, Array<{
        scenarioId: string;
        scenarioName: string;
        emittedCount: number;
        activeViewers: number;
        hps: number;
    }>>;
}
