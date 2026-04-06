import { SimulationScenario } from '../interfaces/scenario.interface';
export interface RunState {
    run_id: string;
    scenario: SimulationScenario | null;
    started_at: Date | null;
    sent: number;
    errors: number;
    running: boolean;
}
export declare class RunManager {
    private state;
    startRun(scenario: SimulationScenario): RunState;
    stopRun(): RunState;
    switchPhase(scenario: SimulationScenario): RunState;
    recordTick(sent: number, errors: number): void;
    getState(): RunState;
    getRunId(): string;
}
