/**
 * Batch Sender: Aggregates heartbeat payloads and sends to Go API in one batch.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import pLimit from 'p-limit';
import { firstValueFrom } from 'rxjs';

export interface HeartbeatPayload {
  session_id: string;
  user_id: string;
  video_id: string;
  playhead: number;
  timestamp: number;
}

export interface BatchResult {
  sent: number;
  errors: number;
}

const DEFAULT_API_URL =
  process.env.RANKING_API_URL ?? 'http://localhost:8080/v1/heartbeat';
const CONCURRENCY = 50;

@Injectable()
export class BatchSender {
  private readonly logger = new Logger(BatchSender.name);

  constructor(private readonly http: HttpService) {}

  async sendBatch(
    payloads: HeartbeatPayload[],
    targetUrl = DEFAULT_API_URL,
  ): Promise<BatchResult> {
    if (payloads.length === 0) return { sent: 0, errors: 0 };

    const limit = pLimit(CONCURRENCY);
    let sent = 0;
    let errors = 0;

    const tasks = payloads.map((payload) =>
      limit(async () => {
        try {
          await firstValueFrom(this.http.post(targetUrl, payload));
          sent++;
        } catch (err: unknown) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`send error: ${msg}`);
        }
      }),
    );

    await Promise.all(tasks);
    return { sent, errors };
  }
}
