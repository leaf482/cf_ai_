/**
 * Scenario Presets - Predefined traffic patterns for the Simulation Factory.
 * Note: the engine now simulates **user lifecycles** (arrive → watch → heartbeat → leave).
 * Preset fields remain for UI compatibility, but the engine uses:
 * - baseTraffic (Poisson arrivals/sec)
 * - injection groups (e.g. hot_trending, viral_spike)
 * - watch duration distribution + Zipf-like video selection
 */

export interface ScenarioPreset {
  id: string;
  name: string;
  description?: string;
  users: number;
  watchSeconds: number;
  intervalMs: number;
  /** Default duration in seconds (0 = until manual stop). User can override. */
  durationSeconds?: number;
  /** watchSeconds < 30: Score will NOT increase (worker threshold) */
  scoreIncreases?: boolean;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'hot_trending',
    name: 'Hot Trending',
    description: 'High engagement, 10s watch',
    users: 10,
    watchSeconds: 10,
    intervalMs: 500,
    durationSeconds: 120,
    scoreIncreases: true,
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Standard load',
    users: 1,
    watchSeconds: 5,
    intervalMs: 500,
    durationSeconds: 120,
    scoreIncreases: true,
  },
  {
    id: 'mild_trending',
    name: 'Mild Trending',
    description: 'Moderate engagement',
    users: 5,
    watchSeconds: 5,
    intervalMs: 500,
    durationSeconds: 120,
    scoreIncreases: true,
  },
  {
    id: 'half_hot_trending',
    name: 'Half Hot Trending',
    description: '3s watch — Score does NOT increase (< 5s threshold)',
    users: 10,
    watchSeconds: 3,
    intervalMs: 500,
    durationSeconds: 120,
    scoreIncreases: false,
  },
  {
    id: 'viral_spike',
    name: 'Viral Spike',
    description: 'High burst, 10s watch',
    users: 20,
    watchSeconds: 10,
    intervalMs: 500,
    durationSeconds: 120,
    scoreIncreases: true,
  },
  {
    id: 'noise_traffic',
    name: 'Noise Traffic',
    description:
      'Spam-like, 3s watch — Score does NOT increase (< 5s threshold)',
    users: 15,
    watchSeconds: 3,
    intervalMs: 500,
    durationSeconds: 60,
    scoreIncreases: false,
  },
  {
    id: 'long_engagement',
    name: 'Long Engagement',
    description: 'Deep watch, 15s',
    users: 2,
    watchSeconds: 15,
    intervalMs: 500,
    durationSeconds: 180,
    scoreIncreases: true,
  },
];

export function getPreset(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}

export function listPresets(): ScenarioPreset[] {
  return [...SCENARIO_PRESETS];
}
