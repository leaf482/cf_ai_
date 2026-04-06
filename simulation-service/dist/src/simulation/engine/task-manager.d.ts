import { SimulationScenario } from '../interfaces/scenario.interface';
import { LoadStrategy } from '../strategies/load.strategy';
export interface TaskManagerConfig {
    targetUrl: string;
    scenario: SimulationScenario;
    getActiveUsers: () => number;
    getElapsedTicks: () => number;
}
export declare class TaskManager {
    private readonly loadStrategy;
    constructor(loadStrategy: LoadStrategy);
    computeBatchSize(activeUsers: number, eventsPerSecond: number): number;
    executeTick(config: TaskManagerConfig, playheads: Map<string, number>): Promise<{
        sent: number;
        errors: number;
    }>;
}
