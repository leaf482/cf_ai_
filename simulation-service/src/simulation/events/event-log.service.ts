/**
 * Event log for chart annotations (Start, Spike, Pause, Resume).
 */

import { Injectable } from '@nestjs/common';

export type EventType =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'spike'
  | 'load_spike';

export interface ScenarioEvent {
  type: EventType;
  scenarioId?: string;
  timestamp: number;
}

@Injectable()
export class EventLogService {
  private events: ScenarioEvent[] = [];
  private readonly MAX_EVENTS = 100;

  record(type: EventType, scenarioId?: string): void {
    this.events.push({
      type,
      scenarioId,
      timestamp: Date.now(),
    });
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  getEvents(sinceMs?: number): ScenarioEvent[] {
    if (sinceMs) {
      const cutoff = Date.now() - sinceMs;
      return this.events.filter((e) => e.timestamp >= cutoff);
    }
    return [...this.events];
  }
}
