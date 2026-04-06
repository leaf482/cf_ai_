import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  SimulationScenario,
  SimulationStatus,
} from './interfaces/scenario.interface';
import { ScenarioConfig } from './engine/scenario-registry';
import {
  LOAD_TEST_PHASES,
  phaseToScenario,
  getPhaseDurationMs,
  COOLDOWN_MS,
} from './engine/load-test-phases';
import { MasterTickScheduler } from './engine/master-tick-scheduler';
import { ScenarioRegistry } from './engine/scenario-registry';

const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);

function toScenarioConfig(scenario: SimulationScenario): ScenarioConfig {
  const durationSec = scenario.duration_seconds;
  const pool =
    scenario.video_ids && scenario.video_ids.length > 0
      ? [...scenario.video_ids]
      : [...DEFAULT_VIDEO_IDS];
  return {
    baseTraffic: { lambdaUsersPerSecond: Math.max(0, scenario.users ?? 0) },
    injection: { type: 'none' },
    videoPool: pool,
    zipfSkew: 1.1,
    durationTicks: durationSec ? durationSec * 10 : undefined,
  };
}

@Injectable()
export class SimulationService implements OnModuleInit {
  private readonly logger = new Logger(SimulationService.name);
  private loadTestPhaseIndex = 0;
  private loadTestTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly scheduler: MasterTickScheduler,
    private readonly registry: ScenarioRegistry,
  ) {}

  onModuleInit(): void {
    this.scheduler.start();
  }

  /** Start simulation with full scenario (legacy / script compatibility) */
  start(scenario: SimulationScenario): { run_id: string } & SimulationStatus {
    const running = this.registry.getRunning();
    if (running.length > 0) {
      throw new ConflictException('A simulation is already running');
    }

    const config = toScenarioConfig(scenario);
    const scenarioId = `run-${Date.now().toString(36)}`;
    this.scheduler.enqueueStart(scenarioId, scenario.name, config);

    return {
      run_id: scenarioId,
      running: true,
      scenario,
      sent: 0,
      errors: 0,
      started_at: new Date(),
    };
  }

  /** Start simulation by registered scenario id */
  startByScenarioId(scenarioId: string): { run_id: string } & SimulationStatus {
    if (scenarioId === 'load_test') {
      return this.runLoadTest();
    }

    const template = this.registry.getTemplate(scenarioId);
    if (!template) {
      throw new ConflictException(`Unknown scenario: ${scenarioId}`);
    }

    const running = this.registry.getRunning();
    if (running.some((s) => s.id === scenarioId)) {
      throw new ConflictException(`Scenario ${scenarioId} is already running`);
    }

    const config: ScenarioConfig = {
      ...template.config,
      durationTicks: template.duration_seconds
        ? template.duration_seconds * 10
        : undefined,
    };

    this.scheduler.enqueueStart(scenarioId, template.name, config);

    return {
      run_id: scenarioId,
      running: true,
      scenario: null,
      sent: 0,
      errors: 0,
      started_at: new Date(),
    };
  }

  private runLoadTest(): { run_id: string } & SimulationStatus {
    const running = this.registry.getRunning();
    if (running.length > 0) {
      throw new ConflictException('A simulation is already running');
    }

    this.loadTestPhaseIndex = 0;
    const phase = LOAD_TEST_PHASES[0];
    const scenario = phaseToScenario(phase);
    const config = toScenarioConfig(scenario);

    this.scheduler.enqueueStart('load_test', phase.name, config);
    this.scheduleLoadTestNextPhase();

    return {
      run_id: 'load_test',
      running: true,
      scenario,
      sent: 0,
      errors: 0,
      started_at: new Date(),
    };
  }

  private scheduleLoadTestNextPhase(): void {
    this.loadTestTimeoutId = setTimeout(() => {
      this.loadTestTimeoutId = null;
      const s = this.registry.get('load_test');
      if (!s) return;

      this.scheduler.enqueueStop('load_test');
      this.loadTestPhaseIndex++;

      if (this.loadTestPhaseIndex >= LOAD_TEST_PHASES.length) {
        this.logger.log(
          `load_test complete — emitted=${s.stats.emittedEvents}`,
        );
        return;
      }

      setTimeout(() => {
        const phase = LOAD_TEST_PHASES[this.loadTestPhaseIndex];
        const scenario = phaseToScenario(phase);
        const config = toScenarioConfig(scenario);
        config.durationTicks = phase.duration_seconds * 10;
        this.scheduler.enqueueSwitchPhase('load_test', config);
        this.logger.log(
          `load_test ${phase.name} (${phase.users} users, ${phase.duration_seconds}s)`,
        );
        this.scheduleLoadTestNextPhase();
      }, COOLDOWN_MS);
    }, getPhaseDurationMs(LOAD_TEST_PHASES[this.loadTestPhaseIndex]));
  }

  stop(): SimulationStatus {
    const running = this.registry.getRunning();
    for (const s of running) {
      this.scheduler.enqueueStop(s.id);
    }
    if (this.loadTestTimeoutId) {
      clearTimeout(this.loadTestTimeoutId);
      this.loadTestTimeoutId = null;
    }
    const totalEmitted = running.reduce((a, s) => a + s.stats.emittedEvents, 0);
    this.logger.log(`stopped — total emitted=${totalEmitted}`);
    return {
      running: false,
      scenario: null,
      sent: totalEmitted,
      errors: 0,
      started_at: null,
    };
  }

  getStatus(): SimulationStatus & { run_id?: string; paused?: boolean } {
    const running = this.registry.getRunning();
    const paused = this.registry.getAll().filter((s) => s.status === 'paused');
    const totalEmitted = this.registry
      .getAll()
      .reduce((a, s) => a + s.stats.emittedEvents, 0);
    const firstRunning = running[0];

    return {
      run_id: firstRunning?.id ?? '',
      running: running.length > 0,
      paused: paused.length > 0 && running.length === 0,
      scenario: null,
      sent: totalEmitted,
      errors: 0,
      started_at: null,
    };
  }

  pause(): void {
    const running = this.registry.getRunning();
    for (const s of running) {
      this.scheduler.enqueuePause(s.id);
    }
    this.logger.log('simulation paused');
  }

  resume(): void {
    const paused = this.registry.getAll().filter((s) => s.status === 'paused');
    for (const s of paused) {
      this.scheduler.enqueueResume(s.id);
    }
    this.logger.log('simulation resumed');
  }

  injectSpike(users = 3000, durationSec = 5): void {
    this.scheduler.enqueueStart('spike-overlay', `Spike +${users}`, {
      baseTraffic: { lambdaUsersPerSecond: 0 },
      injection: {
        type: 'viral_spike',
        targetVideoId: DEFAULT_VIDEO_IDS[0],
        totalUsers: users,
        durationMs: durationSec * 1000,
      },
      videoPool: [...DEFAULT_VIDEO_IDS],
      zipfSkew: 1.2,
    });
    setTimeout(() => {
      this.scheduler.enqueueStop('spike-overlay');
    }, durationSec * 1000);
  }
}
