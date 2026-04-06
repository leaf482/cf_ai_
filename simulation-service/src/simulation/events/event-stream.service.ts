/**
 * Live event stream: last N heartbeat events for UI feed.
 */

import { Injectable } from '@nestjs/common';

export interface StreamEvent {
  userId: string;
  videoId: string;
  timestamp: number;
}

const MAX_EVENTS = 10;

@Injectable()
export class EventStreamService {
  private events: StreamEvent[] = [];

  push(userId: string, videoId: string): void {
    this.events.unshift({
      userId,
      videoId,
      timestamp: Date.now(),
    });
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }
  }

  pushBatch(payloads: Array<{ user_id: string; video_id: string }>): void {
    for (const p of payloads) {
      this.push(p.user_id, p.video_id);
    }
  }

  getEvents(): StreamEvent[] {
    return [...this.events];
  }
}
