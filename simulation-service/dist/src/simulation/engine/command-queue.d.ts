import type { ScenarioConfig, ScenarioStatus } from './scenario-registry';
export type CommandType = 'start' | 'pause' | 'resume' | 'stop' | 'switch_phase';
export interface QueuedCommand {
    scenarioId: string;
    command: CommandType;
    config?: ScenarioConfig;
    name?: string;
    initialStatus?: ScenarioStatus;
}
export declare class CommandQueue {
    private queue;
    enqueue(cmd: QueuedCommand): void;
    drain(): QueuedCommand[];
    private coalesce;
    isEmpty(): boolean;
}
