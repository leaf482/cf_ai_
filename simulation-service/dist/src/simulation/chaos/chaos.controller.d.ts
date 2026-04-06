import { ChaosService } from './chaos.service';
export declare class ChaosController {
    private readonly chaosService;
    constructor(chaosService: ChaosService);
    pauseWorker(id: string): {
        workerId: string;
        status: string;
        message: string;
    };
    getPausedWorkers(): {
        paused: string[];
    };
    loadSpike(): {
        message: string;
        multiplier: number;
        durationMs: number;
    };
}
