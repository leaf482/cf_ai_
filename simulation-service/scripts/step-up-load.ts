/**
 * Step-up load test scenario for Contents Ranking.
 *
 * Phases:
 *   1. 100 users × 2 min
 *   2. 300 users × 2 min
 *   3. 500 users × 2 min
 *   4. 1000 users (until manually stopped or limit reached)
 *
 * Run: npx ts-node scripts/step-up-load.ts
 * Or:  npm run load-test  (if script added to package.json)
 */

const SIM_URL = process.env.SIMULATION_URL ?? 'http://localhost:3000';
const PHASE_DURATION_SEC = 120; // 2 min per phase

const VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);

interface Scenario {
  name: string;
  type: string;
  users: number;
  video_ids: string[];
  watch_seconds: number;
  ramp_up_seconds: number;
  events_per_second: number;
  duration_seconds: number;
}

const PHASES: Omit<Scenario, 'video_ids' | 'watch_seconds' | 'ramp_up_seconds' | 'events_per_second'>[] = [
  { name: 'Phase 1', type: 'normal', users: 100, duration_seconds: PHASE_DURATION_SEC },
  { name: 'Phase 2', type: 'normal', users: 300, duration_seconds: PHASE_DURATION_SEC },
  { name: 'Phase 3', type: 'normal', users: 500, duration_seconds: PHASE_DURATION_SEC },
  { name: 'Phase 4 (limit)', type: 'normal', users: 1000, duration_seconds: 600 }, // 10 min for limit measurement
];

async function post(path: string, body?: object): Promise<unknown> {
  const res = await fetch(`${SIM_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${SIM_URL}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function stop(): Promise<void> {
  await post('/v1/simulation/stop');
  console.log('  Stopped.');
}

async function start(scenario: Scenario): Promise<void> {
  const full: Scenario = {
    ...scenario,
    video_ids: VIDEO_IDS,
    watch_seconds: 30,
    ramp_up_seconds: 10,
    events_per_second: 1,
  };
  await post('/v1/simulation/start', full);
  console.log(`  Started: ${scenario.name} (${scenario.users} users, ${scenario.duration_seconds}s)`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function run(): Promise<void> {
  console.log('Step-up load test');
  console.log('Simulation URL:', SIM_URL);
  console.log('Monitor Grafana: http://localhost:3001 (admin/admin)');
  console.log('');

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    const scenario: Scenario = {
      ...phase,
      video_ids: VIDEO_IDS,
      watch_seconds: 30,
      ramp_up_seconds: 10,
      events_per_second: 1,
    };

    console.log(`[${i + 1}/${PHASES.length}] ${phase.name}: ${phase.users} users, ${phase.duration_seconds}s`);
    if (i > 0) {
      await stop();
      await sleep(3000); // 3s cooldown between phases
    }

    await start(scenario);

    // Wait for phase to complete
    const endAt = Date.now() + phase.duration_seconds * 1000;
    while (Date.now() < endAt) {
      await sleep(10000); // poll every 10s
      const status = (await get('/v1/simulation/status')) as { running: boolean; sent: number; errors: number };
      if (!status.running) {
        console.log(`  Phase ended early. sent=${status.sent} errors=${status.errors}`);
        break;
      }
      const remaining = Math.ceil((endAt - Date.now()) / 1000);
      console.log(`  ... ${remaining}s remaining, sent=${status.sent} errors=${status.errors}`);
    }
  }

  await stop();
  const final = (await get('/v1/simulation/status')) as { sent: number; errors: number };
  console.log('');
  console.log('Load test complete.');
  console.log('Total sent:', final.sent, '| Errors:', final.errors);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
