import { OnModuleInit } from '@nestjs/common';
import { SimulationScenario, SimulationStatus } from './interfaces/scenario.interface';
import { MasterTickScheduler } from './engine/master-tick-scheduler';
import { ScenarioRegistry } from './engine/scenario-registry';
export declare class SimulationService implements OnModuleInit {
    private readonly scheduler;
    private readonly registry;
    private readonly logger;
    private loadTestPhaseIndex;
    private loadTestTimeoutId;
    constructor(scheduler: MasterTickScheduler, registry: ScenarioRegistry);
    onModuleInit(): void;
    start(scenario: SimulationScenario): {
        run_id: string;
    } & SimulationStatus;
    startByScenarioId(scenarioId: string): {
        run_id: string;
    } & SimulationStatus;
    private runLoadTest;
    private scheduleLoadTestNextPhase;
    stop(): SimulationStatus;
    getStatus(): SimulationStatus & {
        run_id?: string;
        paused?: boolean;
    };
    pause(): void;
    resume(): void;
    injectSpike(users?: number, durationSec?: number): void;
}
