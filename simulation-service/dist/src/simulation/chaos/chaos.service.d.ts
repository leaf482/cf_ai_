import { MasterTickScheduler } from '../engine/master-tick-scheduler';
import { ScenarioRegistry } from '../engine/scenario-registry';
import { EventLogService } from '../events/event-log.service';
export declare class ChaosService {
    private readonly scheduler;
    private readonly registry;
    private readonly eventLog;
    private readonly logger;
    private pausedWorkers;
    constructor(scheduler: MasterTickScheduler, registry: ScenarioRegistry, eventLog: EventLogService);
    pauseWorker(workerId: string): {
        workerId: string;
        status: string;
        message: string;
    };
    resumeWorker(workerId: string): {
        workerId: string;
        status: string;
    };
    isWorkerPaused(workerId: string): boolean;
    getPausedWorkers(): string[];
    triggerLoadSpike(): {
        message: string;
        multiplier: number;
        durationMs: number;
    };
}
