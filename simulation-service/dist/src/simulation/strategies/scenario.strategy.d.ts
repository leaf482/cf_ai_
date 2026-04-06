import { SimulationScenario } from '../interfaces/scenario.interface';
import { LoadStrategy } from './load.strategy';
export interface StrategyHandle {
    stop: () => void;
    onTick: (cb: (sent: number, errors: number) => void) => void;
}
export declare class ScenarioStrategy {
    private readonly load;
    private readonly logger;
    constructor(load: LoadStrategy);
    run(targetUrl: string, scenario: SimulationScenario): StrategyHandle;
}
