/**
 * Control Queue: User requests (Start, Pause, Resume, Stop) are queued
 * and coalesced at the start of each Master Tick.
 */

import type { ScenarioConfig, ScenarioStatus } from './scenario-registry';

export type CommandType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'switch_phase';

export interface QueuedCommand {
  scenarioId: string;
  command: CommandType;
  /** For 'start': scenario config */
  config?: ScenarioConfig;
  /** For 'start': scenario name */
  name?: string;
  /** For 'start': when coalesced with pause, create in paused state */
  initialStatus?: ScenarioStatus;
}

export class CommandQueue {
  private queue: QueuedCommand[] = [];

  enqueue(cmd: QueuedCommand): void {
    this.queue.push(cmd);
  }

  /**
   * Drain and coalesce: later command for same scenarioId overrides.
   * Returns coalesced commands to apply to Registry.
   *
   * Coalesce rules:
   * - start + pause → start with initialStatus: 'paused'
   * - start + stop → stop (don't create)
   * - start + resume → start (resume redundant)
   * - pause/resume after stop → drop (scenario gone)
   */
  drain(): QueuedCommand[] {
    const applied = new Map<string, QueuedCommand>();
    for (const cmd of this.queue) {
      const existing = applied.get(cmd.scenarioId);
      const merged = this.coalesce(existing, cmd);
      if (merged) applied.set(cmd.scenarioId, merged);
    }
    this.queue = [];
    return Array.from(applied.values());
  }

  private coalesce(
    existing: QueuedCommand | undefined,
    incoming: QueuedCommand,
  ): QueuedCommand | null {
    if (!existing) return incoming;

    switch (incoming.command) {
      case 'start':
        return incoming;
      case 'stop':
        return { ...incoming };
      case 'pause':
        if (existing.command === 'stop') return null;
        if (existing.command === 'start') {
          return { ...existing, initialStatus: 'paused' as ScenarioStatus };
        }
        return { ...incoming };
      case 'resume':
        if (existing.command === 'stop') return null;
        if (existing.command === 'start') return existing;
        return { ...incoming };
      case 'switch_phase':
        return incoming.config ? { ...incoming } : null;
      default:
        return incoming;
    }
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
