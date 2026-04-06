import { SimulationScenario } from '../interfaces/scenario.interface';
export interface LoadTestPhase {
    name: string;
    users: number;
    duration_seconds: number;
}
export declare const LOAD_TEST_PHASES: LoadTestPhase[];
declare const COOLDOWN_MS = 3000;
export declare function phaseToScenario(phase: LoadTestPhase): SimulationScenario;
export declare function getPhaseDurationMs(phase: LoadTestPhase): number;
export { COOLDOWN_MS };
