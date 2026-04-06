export type SimulationType = 'normal' | 'spike' | 'gradual';

export class SimulationScenario {
  /** Human-readable label for the scenario */
  name: string;

  /** Traffic shape */
  type: SimulationType;

  /** Number of concurrent simulated users */
  users: number;

  /** Pool of video IDs to distribute watch events across */
  video_ids: string[];

  /** How many seconds each user watches per event cycle */
  watch_seconds: number;

  /** Seconds over which user load ramps up from 0 to `users` */
  ramp_up_seconds: number;

  /** Target event throughput (events/second) across all users */
  events_per_second: number;

  /**
   * Total duration of the simulation in seconds.
   * Undefined means run until manually stopped.
   */
  duration_seconds?: number;
}

export class SimulationStatus {
  running: boolean;
  scenario: SimulationScenario | null;
  sent: number;
  errors: number;
  started_at: Date | null;
}
