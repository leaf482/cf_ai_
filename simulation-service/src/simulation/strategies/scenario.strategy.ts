import { Injectable, Logger } from '@nestjs/common';
import { SimulationScenario } from '../interfaces/scenario.interface';
import { LoadStrategy } from './load.strategy';

export interface StrategyHandle {
  stop: () => void;
  onTick: (cb: (sent: number, errors: number) => void) => void;
}

@Injectable()
export class ScenarioStrategy {
  private readonly logger = new Logger(ScenarioStrategy.name);

  constructor(private readonly load: LoadStrategy) {}

  /**
   * Starts the simulation loop and returns a handle to stop it.
   *
   * Ramp-up: every second during ramp_up_seconds, we add
   * (users / ramp_up_seconds) users until the full cohort is active.
   *
   * Each tick fires `activeUsers * events_per_second` events, spread
   * across the available video pool, then sleeps until the next second.
   */
  run(targetUrl: string, scenario: SimulationScenario): StrategyHandle {
    let stopped = false;
    let tickCallback: ((sent: number, errors: number) => void) | null = null;

    // Per-user playhead state so each user has continuous progress
    const playheads = new Map<string, number>();
    const allUserIds = Array.from(
      { length: scenario.users },
      (_, i) => `user-${i + 1}`,
    );

    const usersPerRampStep = Math.max(
      1,
      Math.floor(scenario.users / Math.max(scenario.ramp_up_seconds, 1)),
    );

    const loop = async () => {
      let activeUsers = 0;
      let elapsed = 0;

      while (!stopped) {
        const tickStart = Date.now();

        // Ramp-up: add a batch of users each second until fully ramped
        if (elapsed < scenario.ramp_up_seconds) {
          activeUsers = Math.min(
            activeUsers + usersPerRampStep,
            scenario.users,
          );
          this.logger.debug(
            `ramp-up: ${activeUsers}/${scenario.users} users active`,
          );
        } else {
          activeUsers = scenario.users;
        }

        if (activeUsers > 0) {
          const eventsThisTick = Math.round(
            activeUsers * scenario.events_per_second,
          );
          const concurrency = Math.min(eventsThisTick, 50);
          const activeUserIds = allUserIds.slice(0, activeUsers);

          const { sent, errors } = await this.load.sendBurst(
            targetUrl,
            scenario,
            activeUserIds,
            playheads,
            eventsThisTick,
            concurrency,
          );

          tickCallback?.(sent, errors);
          this.logger.debug(`tick ${elapsed}s: sent=${sent} errors=${errors}`);
        }

        // Stop after duration if set
        elapsed++;
        if (scenario.duration_seconds && elapsed >= scenario.duration_seconds) {
          this.logger.log('simulation duration reached, stopping');
          stopped = true;
          break;
        }

        // Sleep for the remainder of the 1-second tick window
        const elapsed_ms = Date.now() - tickStart;
        const remaining = Math.max(0, 1000 - elapsed_ms);
        await new Promise((r) => setTimeout(r, remaining));
      }
    };

    // Fire and forget — errors inside are caught per-request in LoadStrategy
    void loop();

    return {
      stop: () => {
        stopped = true;
      },
      onTick: (cb) => {
        tickCallback = cb;
      },
    };
  }
}
