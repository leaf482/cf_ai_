import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import pLimit from 'p-limit';
import { firstValueFrom } from 'rxjs';
import { SimulationScenario } from '../interfaces/scenario.interface';

export interface EventResult {
  sent: number;
  errors: number;
}

@Injectable()
export class LoadStrategy {
  private readonly logger = new Logger(LoadStrategy.name);

  constructor(private readonly http: HttpService) {}

  /**
   * Fires a single burst of `count` heartbeat events concurrently,
   * bounded by `concurrency`. Returns sent/error counts for that burst.
   */
  async sendBurst(
    targetUrl: string,
    scenario: SimulationScenario,
    userIds: string[],
    playheads: Map<string, number>,
    count: number,
    concurrency: number,
  ): Promise<EventResult> {
    const limit = pLimit(concurrency);
    let sent = 0;
    let errors = 0;

    const tasks = Array.from({ length: count }, (_, i) => {
      const userId = userIds[i % userIds.length];
      const videoId =
        scenario.video_ids[
          Math.floor(Math.random() * scenario.video_ids.length)
        ];

      // Advance this user's playhead by watch_seconds (converted to ms)
      const prev = playheads.get(userId) ?? 0;
      const next = prev + scenario.watch_seconds * 1000;
      playheads.set(userId, next);

      const payload = {
        session_id: `sim-${userId}`,
        user_id: userId,
        video_id: videoId,
        playhead: next,
        timestamp: Date.now(),
      };

      return limit(async () => {
        try {
          await firstValueFrom(this.http.post(targetUrl, payload));
          sent++;
        } catch (err: unknown) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`send error: ${msg}`);
        }
      });
    });

    await Promise.all(tasks);
    return { sent, errors };
  }
}
