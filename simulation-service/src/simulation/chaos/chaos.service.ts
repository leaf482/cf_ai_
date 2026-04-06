import { Injectable, Logger } from '@nestjs/common';
import { MasterTickScheduler } from '../engine/master-tick-scheduler';
import { ScenarioRegistry } from '../engine/scenario-registry';
import { EventLogService } from '../events/event-log.service';

const LOAD_SPIKE_MULTIPLIER = 5;
const LOAD_SPIKE_DURATION_MS = 5000;

@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);
  private pausedWorkers = new Set<string>();

  constructor(
    private readonly scheduler: MasterTickScheduler,
    private readonly registry: ScenarioRegistry,
    private readonly eventLog: EventLogService,
  ) {}

  pauseWorker(workerId: string) {
    this.pausedWorkers.add(workerId);
    this.logger.log(`worker ${workerId} marked as paused (logical)`);
    return {
      workerId,
      status: 'paused',
      message:
        'Worker is logically paused. Resume via worker API when implemented.',
    };
  }

  resumeWorker(workerId: string) {
    this.pausedWorkers.delete(workerId);
    this.logger.log(`worker ${workerId} resumed`);
    return { workerId, status: 'resumed' };
  }

  isWorkerPaused(workerId: string): boolean {
    return this.pausedWorkers.has(workerId);
  }

  getPausedWorkers(): string[] {
    return Array.from(this.pausedWorkers);
  }

  triggerLoadSpike() {
    this.scheduler.enqueueLoadSpike(
      LOAD_SPIKE_MULTIPLIER,
      LOAD_SPIKE_DURATION_MS,
    );
    this.eventLog.record('load_spike');
    this.logger.log(
      `load spike: ${LOAD_SPIKE_MULTIPLIER}x for ${LOAD_SPIKE_DURATION_MS}ms`,
    );
    return {
      message: `Load spike applied: ${LOAD_SPIKE_MULTIPLIER}x for 5 seconds`,
      multiplier: LOAD_SPIKE_MULTIPLIER,
      durationMs: LOAD_SPIKE_DURATION_MS,
    };
  }
}
