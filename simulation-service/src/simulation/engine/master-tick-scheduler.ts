/**
 * Master Tick Scheduler: 100ms period.
 * - Processes CommandQueue at tick start (coalesce → Registry)
 * - Iterates all 'running' scenarios, aggregates heartbeats
 * - Sends aggregated batch to Go API in one call
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Scenario, ScenarioConfig } from './scenario-registry';
import { ScenarioRegistry } from './scenario-registry';
import { CommandQueue, QueuedCommand } from './command-queue';
import { AttributionIndex } from './attribution-index';
import { BatchSender, HeartbeatPayload } from './batch-sender';
import { EventLogService } from '../events/event-log.service';
import { EventStreamService } from '../events/event-stream.service';
import {
  buildWatchDurationSampler,
  buildZipfSelector,
  samplePoisson,
  sampleWeighted,
} from './sampling';
import { createUserSession, type UserSession } from './user-session';

const TICK_MS = 100;
const DEFAULT_API_URL =
  process.env.RANKING_API_URL ?? 'http://localhost:8080/v1/heartbeat';

@Injectable()
export class MasterTickScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(MasterTickScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTickAtMs = 0;

  constructor(
    private readonly registry: ScenarioRegistry,
    private readonly commandQueue: CommandQueue,
    private readonly attributionIndex: AttributionIndex,
    private readonly batchSender: BatchSender,
    private readonly eventLog: EventLogService,
    private readonly eventStream: EventStreamService,
  ) {}

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log('Master tick scheduler started (100ms period)');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Master tick scheduler stopped');
  }

  enqueueStart(scenarioId: string, name: string, config: ScenarioConfig): void {
    this.commandQueue.enqueue({
      scenarioId,
      command: 'start',
      name,
      config,
    });
  }

  enqueuePause(scenarioId: string): void {
    this.commandQueue.enqueue({ scenarioId, command: 'pause' });
  }

  enqueueResume(scenarioId: string): void {
    this.commandQueue.enqueue({ scenarioId, command: 'resume' });
  }

  enqueueStop(scenarioId: string): void {
    this.commandQueue.enqueue({ scenarioId, command: 'stop' });
  }

  enqueueSwitchPhase(scenarioId: string, config: ScenarioConfig): void {
    this.commandQueue.enqueue({
      scenarioId,
      command: 'switch_phase',
      config,
    });
  }

  /** Apply spike to a specific scenario (multiplier x for durationMs) */
  enqueueSpike(
    scenarioId: string,
    multiplier: number,
    durationMs: number,
  ): void {
    const s = this.registry.get(scenarioId);
    if (s) this.registry.setSpike(scenarioId, multiplier, durationMs);
  }

  /** Apply spike to all running scenarios */
  enqueueLoadSpike(multiplier: number, durationMs: number): void {
    this.registry.setSpikeAll(multiplier, durationMs);
  }

  private applyCommands(commands: QueuedCommand[]): void {
    for (const cmd of commands) {
      switch (cmd.command) {
        case 'start':
          if (cmd.config && cmd.name) {
            const existing = this.registry.get(cmd.scenarioId);
            if (existing) {
              // Clear old attribution if any
              const oldTarget =
                existing.config.injection?.targetVideoId ??
                existing.config.videoPool?.[0];
              if (oldTarget)
                this.attributionIndex.clearScenario(cmd.scenarioId, oldTarget);
            }
            this.registry.create(cmd.scenarioId, cmd.name, cmd.config);
            if (cmd.initialStatus === 'paused') {
              this.registry.setStatus(cmd.scenarioId, 'paused');
            }
            const target =
              cmd.config.injection?.targetVideoId ?? cmd.config.videoPool?.[0];
            if (target)
              this.attributionIndex.setScenarioVideo(cmd.scenarioId, target);
            this.eventLog.record('start', cmd.scenarioId);
            const durationSeconds = cmd.config.durationTicks
              ? (cmd.config.durationTicks * TICK_MS) / 1000
              : undefined;
            this.logger.log(
              `scenario started id=${cmd.scenarioId} name="${cmd.name}" lambda=${cmd.config.baseTraffic?.lambdaUsersPerSecond ?? 0}` +
                ` durationSec=${durationSeconds ?? '∞'}${cmd.initialStatus === 'paused' ? ' [paused]' : ''}`,
            );
          }
          break;
        case 'pause':
          this.registry.setStatus(cmd.scenarioId, 'paused');
          this.eventLog.record('pause', cmd.scenarioId);
          this.logger.debug(`paused ${cmd.scenarioId}`);
          break;
        case 'resume':
          this.registry.setStatus(cmd.scenarioId, 'running');
          this.eventLog.record('resume', cmd.scenarioId);
          this.logger.debug(`resumed ${cmd.scenarioId}`);
          break;
        case 'stop': {
          const s = this.registry.get(cmd.scenarioId);
          if (s) {
            const target =
              s.config.injection?.targetVideoId ?? s.config.videoPool?.[0];
            if (target)
              this.attributionIndex.clearScenario(cmd.scenarioId, target);
            this.registry.setStatus(cmd.scenarioId, 'stopped');
            this.registry.remove(cmd.scenarioId);
            this.eventLog.record('stop', cmd.scenarioId);
            this.logger.log(`stopped ${cmd.scenarioId}`);
          }
          break;
        }
        case 'switch_phase': {
          if (cmd.config) {
            const existing = this.registry.get(cmd.scenarioId);
            if (existing) {
              const oldTarget =
                existing.config.injection?.targetVideoId ??
                existing.config.videoPool?.[0];
              if (oldTarget)
                this.attributionIndex.clearScenario(cmd.scenarioId, oldTarget);
            }
            this.registry.updateConfig(cmd.scenarioId, cmd.config);
            const newTarget =
              cmd.config.injection?.targetVideoId ?? cmd.config.videoPool?.[0];
            if (newTarget)
              this.attributionIndex.setScenarioVideo(cmd.scenarioId, newTarget);
            this.logger.log(
              `switch_phase ${cmd.scenarioId} (lambda=${cmd.config.baseTraffic?.lambdaUsersPerSecond ?? 0})`,
            );
          }
          break;
        }
      }
    }
  }

  private isSpikeActive(scenario: Scenario, nowMs: number): boolean {
    if (
      scenario.loadMultiplier &&
      scenario.spikeEndMs &&
      nowMs < scenario.spikeEndMs
    )
      return true;
    if (scenario.spikeEndMs && nowMs >= scenario.spikeEndMs) {
      scenario.loadMultiplier = undefined;
      scenario.spikeEndMs = undefined;
    }
    return false;
  }

  private scenarioRng(): () => number {
    // Deterministic-ish per process; sufficient for simulation
    return Math.random;
  }

  private createSessionsForScenario(
    scenario: Scenario,
    count: number,
    nowMs: number,
    opts?: {
      forceVideoId?: string;
      watchDurationDistribution?: Array<{ seconds: number; weight: number }>;
    },
  ): UserSession[] {
    if (count <= 0) return [];

    const rng = this.scenarioRng();
    const skew = scenario.config.zipfSkew ?? 1.1;
    const pool = scenario.config.videoPool;
    const popularity = scenario.config.videoPopularity;
    const selector =
      popularity && popularity.length > 0
        ? {
            pick: () =>
              sampleWeighted(
                rng,
                popularity.map((p) => ({ value: p.videoId, weight: p.weight })),
              ),
          }
        : buildZipfSelector(rng, pool, skew);
    const sampler = buildWatchDurationSampler(
      rng,
      opts?.watchDurationDistribution ??
        scenario.config.watchDurationDistribution,
    );

    const sessions: UserSession[] = [];
    for (let i = 0; i < count; i++) {
      const userId = `${scenario.id}-u${++scenario.userSeq}`;
      const videoId = opts?.forceVideoId ?? selector.pick();
      const watchDurationMs = sampler.sample();
      sessions.push(
        createUserSession({
          userId,
          videoId,
          watchDurationMs,
          nowMs,
          heartbeatIntervalMs: scenario.config.heartbeatIntervalMs ?? 500,
          sessionPrefix: 'sim',
        }),
      );
    }
    return sessions;
  }

  private generateArrivals(scenario: Scenario, nowMs: number): UserSession[] {
    const rng = this.scenarioRng();
    const spikeActive = this.isSpikeActive(scenario, nowMs);
    const multiplier = spikeActive ? (scenario.loadMultiplier ?? 1) : 1;

    const baseLambda =
      (scenario.config.baseTraffic?.lambdaUsersPerSecond ?? 0) * multiplier;
    const baseArrivals = samplePoisson(rng, baseLambda);

    let injectedArrivals = 0;
    const inj = scenario.config.injection;
    const sinceStartMs = nowMs - scenario.startedAtMs;

    if (inj && inj.type !== 'none') {
      const durationMs = Math.max(0, inj.durationMs ?? 0);
      const totalUsers = Math.max(0, inj.totalUsers ?? 0);
      if (
        durationMs > 0 &&
        totalUsers > 0 &&
        sinceStartMs >= 0 &&
        sinceStartMs < durationMs
      ) {
        const lambda = (totalUsers / (durationMs / 1000)) * multiplier;
        injectedArrivals = samplePoisson(rng, lambda);
      }
    }

    const sessions: UserSession[] = [];

    // Base traffic sessions
    sessions.push(
      ...this.createSessionsForScenario(scenario, baseArrivals, nowMs),
    );

    // Injection sessions (scenario-specific biases)
    if (injectedArrivals > 0 && inj) {
      if (inj.type === 'hot_trending') {
        sessions.push(
          ...this.createSessionsForScenario(scenario, injectedArrivals, nowMs, {
            forceVideoId: inj.targetVideoId,
            watchDurationDistribution: [
              { seconds: 3, weight: 20 },
              { seconds: 10, weight: 30 },
              { seconds: 30, weight: 30 },
              { seconds: 60, weight: 20 },
            ],
          }),
        );
      } else if (inj.type === 'viral_spike') {
        sessions.push(
          ...this.createSessionsForScenario(scenario, injectedArrivals, nowMs, {
            forceVideoId: inj.targetVideoId,
            watchDurationDistribution: [
              { seconds: 3, weight: 70 },
              { seconds: 10, weight: 25 },
              { seconds: 30, weight: 4 },
              { seconds: 60, weight: 1 },
            ],
          }),
        );
      }
    }

    return sessions;
  }

  private updateSessionsAndBuildHeartbeats(
    scenario: Scenario,
    nowMs: number,
    elapsedMs: number,
  ): HeartbeatPayload[] {
    const payloads: HeartbeatPayload[] = [];
    const toDelete: string[] = [];

    for (const [userId, session] of scenario.sessions) {
      const nextPlayhead = session.playheadMs + elapsedMs;
      session.playheadMs = nextPlayhead;

      // Session ends once watch duration is reached.
      if (session.playheadMs >= session.watchDurationMs) {
        toDelete.push(userId);
        continue;
      }

      // Emit heartbeat only when due (per-session cadence), even though tick is 100ms.
      if (nowMs >= session.nextHeartbeatDueAt) {
        payloads.push({
          session_id: session.sessionId,
          user_id: session.userId,
          video_id: session.videoId,
          playhead: session.playheadMs,
          timestamp: nowMs,
        });
        session.lastHeartbeatAt = nowMs;

        // Advance schedule; if ticks were delayed, catch up without changing cadence.
        do {
          session.nextHeartbeatDueAt += session.heartbeatIntervalMs;
        } while (nowMs >= session.nextHeartbeatDueAt);
      }
    }

    for (const userId of toDelete) {
      scenario.sessions.delete(userId);
    }
    scenario.activeUsers = scenario.sessions.size;
    return payloads;
  }

  private async tick(): Promise<void> {
    const nowMs = Date.now();
    if (this.lastTickAtMs === 0) this.lastTickAtMs = nowMs;
    const elapsedMs = Math.max(0, Math.min(nowMs - this.lastTickAtMs, 1000));
    this.lastTickAtMs = nowMs;

    const commands = this.commandQueue.drain();
    if (commands.length > 0) {
      this.applyCommands(commands);
    }

    const running = this.registry.getRunning();
    if (running.length === 0) return;

    const allPayloads: HeartbeatPayload[] = [];
    const countsPerScenario: Map<string, number> = new Map();

    for (const scenario of running) {
      scenario.elapsedTicks++;

      if (
        scenario.config.durationTicks &&
        scenario.elapsedTicks >= scenario.config.durationTicks
      ) {
        const target =
          scenario.config.injection?.targetVideoId ??
          scenario.config.videoPool?.[0];
        if (target) this.attributionIndex.clearScenario(scenario.id, target);
        this.registry.remove(scenario.id);
        this.logger.log(`scenario ${scenario.id} duration reached, stopped`);
        continue;
      }

      // 1) Generate new users (base traffic + injection) on 1-second boundaries (10 ticks).
      if (scenario.elapsedTicks % 10 === 0) {
        const maxSessions = scenario.config.maxConcurrentSessions ?? 20_000;
        if (scenario.sessions.size < maxSessions) {
          const arrivals = this.generateArrivals(scenario, nowMs);
          for (const sess of arrivals) {
            if (scenario.sessions.size >= maxSessions) break;
            scenario.sessions.set(sess.userId, sess);
          }
        }
      }

      // 2) Update sessions and emit heartbeats for active sessions
      const payloads = this.updateSessionsAndBuildHeartbeats(
        scenario,
        nowMs,
        elapsedMs,
      );
      if (payloads.length > 0) {
        allPayloads.push(...payloads);
        countsPerScenario.set(scenario.id, payloads.length);
      }
    }

    if (allPayloads.length > 0) {
      this.eventStream.pushBatch(
        allPayloads.map((p) => ({ user_id: p.user_id, video_id: p.video_id })),
      );
      const { sent } = await this.batchSender.sendBatch(
        allPayloads,
        DEFAULT_API_URL,
      );
      const ratio = sent / allPayloads.length;
      for (const [id, count] of countsPerScenario) {
        const s = this.registry.get(id);
        if (s) s.stats.emittedEvents += Math.round(count * ratio);
      }
    }
  }

  getRegistry(): ScenarioRegistry {
    return this.registry;
  }
}
