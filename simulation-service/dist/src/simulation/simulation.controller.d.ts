import { SimulationService } from './simulation.service';
import { SimulationScenario, SimulationStatus } from './interfaces/scenario.interface';
import { ScenarioRegistry } from './engine/scenario-registry';
export declare class SimulationController {
    private readonly simulationService;
    private readonly registry;
    constructor(simulationService: SimulationService, registry: ScenarioRegistry);
    start(scenario: SimulationScenario): SimulationStatus;
    startByScenario(scenarioId: string): SimulationStatus;
    stop(): SimulationStatus;
    pause(): {
        paused: boolean;
    };
    resume(): {
        paused: boolean;
    };
    spike(): {
        message: string;
    };
    status(): SimulationStatus & {
        run_id?: string;
    };
    scenarios(): import("./engine/scenario-registry").ScenarioTemplate[];
}
