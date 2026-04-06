import { HttpService } from '@nestjs/axios';
import { SimulationScenario } from '../interfaces/scenario.interface';
export interface EventResult {
    sent: number;
    errors: number;
}
export declare class LoadStrategy {
    private readonly http;
    private readonly logger;
    constructor(http: HttpService);
    sendBurst(targetUrl: string, scenario: SimulationScenario, userIds: string[], playheads: Map<string, number>, count: number, concurrency: number): Promise<EventResult>;
}
