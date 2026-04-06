import { Injectable, NotFoundException } from '@nestjs/common';
import { ScenarioConfig } from '../engine/scenario-registry';
import { MasterTickScheduler } from '../engine/master-tick-scheduler';
import { ScenarioRegistry } from '../engine/scenario-registry';
import { AttributionIndex } from '../engine/attribution-index';
import { EventLogService } from '../events/event-log.service';
import { getPreset } from './presets.constants';
import type { CreateScenarioDto } from './factory.controller';

const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);

@Injectable()
export class FactoryService {
  constructor(
    private readonly scheduler: MasterTickScheduler,
    private readonly registry: ScenarioRegistry,
    private readonly attributionIndex: AttributionIndex,
    private readonly eventLog: EventLogService,
  ) {}

  createAndStart(dto: CreateScenarioDto) {
    const scenarioId = `scenario-${Date.now().toString(36)}`;

    let users: number;
    let durationSeconds: number | undefined;
    let name: string;
    let presetId: string | undefined;

    if (dto.presetId) {
      const preset = getPreset(dto.presetId);
      if (!preset) {
        throw new NotFoundException(`Preset '${dto.presetId}' not found`);
      }
      users = dto.users ?? preset.users;
      durationSeconds = dto.durationSeconds ?? preset.durationSeconds;
      name = dto.name?.trim() || preset.name;
      presetId = preset.id;
    } else {
      users = dto.users ?? 100;
      durationSeconds = dto.durationSeconds;
      name = dto.name?.trim() || `Scenario ${Date.now().toString(36)}`;
    }

    const videoId = dto.targetVideoId ?? DEFAULT_VIDEO_IDS[0];
    const videoPool = [
      videoId,
      ...DEFAULT_VIDEO_IDS.filter((v) => v !== videoId),
    ];

    // Base traffic: interpret `users` as lambdaUsersPerSecond for non-injection presets.
    // For injection presets, `users` is totalUsers injected over the injection window.
    const baseLambda =
      presetId && (presetId === 'hot_trending' || presetId === 'viral_spike')
        ? 20
        : Math.max(0, users);

    const config: ScenarioConfig = {
      baseTraffic: { lambdaUsersPerSecond: baseLambda },
      injection: { type: 'none' },
      videoPool,
      zipfSkew: 1.2,
      durationTicks: durationSeconds ? durationSeconds * 10 : undefined,
    };

    // Scenario injections (special user groups)
    if (presetId === 'hot_trending') {
      config.injection = {
        type: 'hot_trending',
        targetVideoId: videoId,
        totalUsers: Math.max(0, users),
        durationMs: 30_000,
      };
      config.watchDurationDistribution = [
        { seconds: 3, weight: 15 },
        { seconds: 10, weight: 30 },
        { seconds: 30, weight: 35 },
        { seconds: 60, weight: 20 },
      ];
    } else if (presetId === 'viral_spike') {
      config.injection = {
        type: 'viral_spike',
        targetVideoId: videoId,
        totalUsers: Math.max(0, users),
        durationMs: 5_000,
      };
      // Mostly short watch times
      config.watchDurationDistribution = [
        { seconds: 3, weight: 70 },
        { seconds: 10, weight: 25 },
        { seconds: 30, weight: 4 },
        { seconds: 60, weight: 1 },
      ];
    } else if (
      presetId === 'half_hot_trending' ||
      presetId === 'noise_traffic'
    ) {
      // Noise: keep watch times short so ranking stays mostly unaffected
      config.watchDurationDistribution = [{ seconds: 3, weight: 100 }];
    } else if (presetId === 'long_engagement') {
      config.watchDurationDistribution = [
        { seconds: 3, weight: 5 },
        { seconds: 10, weight: 20 },
        { seconds: 30, weight: 45 },
        { seconds: 60, weight: 30 },
      ];
    }

    this.scheduler.enqueueStart(scenarioId, name, config);

    return {
      id: scenarioId,
      name,
      config,
      message: 'Scenario created and started',
    };
  }

  listActive() {
    const scenarios = this.registry
      .getAll()
      .filter((s) => s.status !== 'stopped');
    return scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      config: s.config,
      stats: {
        emittedEvents: s.stats.emittedEvents,
        activeUsers: s.activeUsers,
        elapsedTicks: s.elapsedTicks,
      },
    }));
  }

  patchScenario(id: string, action: 'pause' | 'resume' | 'spike' | 'stop') {
    const scenario = this.registry.get(id);
    if (!scenario) {
      throw new NotFoundException(`Scenario ${id} not found`);
    }

    switch (action) {
      case 'pause':
        this.scheduler.enqueuePause(id);
        return { id, action: 'paused' };
      case 'resume':
        this.scheduler.enqueueResume(id);
        return { id, action: 'resumed' };
      case 'spike':
        if (scenario.status !== 'running') {
          throw new NotFoundException(
            `Spike only applies to running scenarios (${id} is ${scenario.status})`,
          );
        }
        this.scheduler.enqueueSpike(id, 5, 5000);
        this.eventLog.record('spike', id);
        return { id, action: 'spike_injected' };
      case 'stop':
        this.scheduler.enqueueStop(id);
        this.eventLog.record('stop', id);
        return { id, action: 'stopped' };
      default:
        throw new NotFoundException('Unknown action');
    }
  }

  getAttribution(): Record<string, string[]> {
    const all = this.attributionIndex.getAll();
    const out: Record<string, string[]> = {};
    for (const [videoId, scenarioIds] of all) {
      const names = scenarioIds
        .map((id) => this.registry.get(id)?.name ?? id)
        .filter(Boolean);
      if (names.length > 0) out[videoId] = names;
    }
    return out;
  }

  /** Attribution with emitted counts per scenario (for tooltips) */
  getAttributionDetail(): Record<
    string,
    Array<{
      scenarioId: string;
      scenarioName: string;
      emittedCount: number;
      activeViewers: number;
      hps: number;
    }>
  > {
    const all = this.attributionIndex.getAll();
    const out: Record<
      string,
      Array<{
        scenarioId: string;
        scenarioName: string;
        emittedCount: number;
        activeViewers: number;
        hps: number;
      }>
    > = {};
    for (const [videoId, scenarioIds] of all) {
      const details = scenarioIds
        .map((id) => {
          const s = this.registry.get(id);
          if (!s) return null;
          const elapsedSec = s.elapsedTicks * 0.1 || 1;
          return {
            scenarioId: id,
            scenarioName: s.name,
            emittedCount: s.stats.emittedEvents,
            activeViewers: s.activeUsers,
            hps: s.stats.emittedEvents / elapsedSec,
          };
        })
        .filter(Boolean) as Array<{
        scenarioId: string;
        scenarioName: string;
        emittedCount: number;
        activeViewers: number;
        hps: number;
      }>;
      if (details.length > 0) out[videoId] = details;
    }
    return out;
  }
}
