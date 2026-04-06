/**
 * Task Manager: Calculates Heartbeat batch size per tick based on active users
 * and delegates sending to LoadStrategy.
 */

import { Injectable } from '@nestjs/common';
import { SimulationScenario } from '../interfaces/scenario.interface';
import { LoadStrategy } from '../strategies/load.strategy';

const TICK_MS = 100;
const TICKS_PER_SECOND = 1000 / TICK_MS;

export interface TaskManagerConfig {
  targetUrl: string;
  scenario: SimulationScenario;
  /** Callback to get current active user count (for ramp-up) */
  getActiveUsers: () => number;
  /** Callback to get elapsed ticks */
  getElapsedTicks: () => number;
}

@Injectable()
export class TaskManager {
  constructor(private readonly loadStrategy: LoadStrategy) {}

  /**
   * Compute events to send this tick.
   * events_per_second is per second; per 100ms tick we send 1/10 of that per active user.
   */
  computeBatchSize(activeUsers: number, eventsPerSecond: number): number {
    const eventsPerTick = (activeUsers * eventsPerSecond) / TICKS_PER_SECOND;
    return Math.round(eventsPerTick);
  }

  /**
   * Execute one tick: compute batch, send to API, return sent/errors.
   * playheads is mutated in-place by LoadStrategy (user progress).
   */
  async executeTick(
    config: TaskManagerConfig,
    playheads: Map<string, number>,
  ): Promise<{ sent: number; errors: number }> {
    const activeUsers = config.getActiveUsers();
    if (activeUsers <= 0) return { sent: 0, errors: 0 };

    const batchSize = this.computeBatchSize(
      activeUsers,
      config.scenario.events_per_second,
    );
    if (batchSize <= 0) return { sent: 0, errors: 0 };

    const allUserIds = Array.from(
      { length: config.scenario.users },
      (_, i) => `user-${i + 1}`,
    );
    const activeUserIds = allUserIds.slice(0, activeUsers);
    const concurrency = Math.min(batchSize, 50);

    return this.loadStrategy.sendBurst(
      config.targetUrl,
      config.scenario,
      activeUserIds,
      playheads,
      batchSize,
      concurrency,
    );
  }
}
