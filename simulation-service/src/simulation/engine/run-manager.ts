/**
 * Run Manager: run_id issuance and simulation run state.
 */

import { randomUUID } from 'crypto';
import { SimulationScenario } from '../interfaces/scenario.interface';

export interface RunState {
  run_id: string;
  scenario: SimulationScenario | null;
  started_at: Date | null;
  /** Total heartbeats sent this run */
  sent: number;
  /** Total errors this run */
  errors: number;
  /** Whether simulation is currently running */
  running: boolean;
}

export class RunManager {
  private state: RunState = {
    run_id: '',
    scenario: null,
    started_at: null,
    sent: 0,
    errors: 0,
    running: false,
  };

  /** Start a new run, issue run_id */
  startRun(scenario: SimulationScenario): RunState {
    const run_id = randomUUID().slice(0, 8);
    this.state = {
      run_id,
      scenario: { ...scenario },
      started_at: new Date(),
      sent: 0,
      errors: 0,
      running: true,
    };
    return { ...this.state };
  }

  /** Stop the current run */
  stopRun(): RunState {
    this.state.running = false;
    return { ...this.state };
  }

  /** Switch to next phase (keep run_id, sent, errors) */
  switchPhase(scenario: SimulationScenario): RunState {
    this.state.scenario = { ...scenario };
    this.state.running = true;
    return { ...this.state };
  }

  /** Record tick results */
  recordTick(sent: number, errors: number): void {
    this.state.sent += sent;
    this.state.errors += errors;
  }

  getState(): RunState {
    return { ...this.state };
  }

  getRunId(): string {
    return this.state.run_id;
  }
}
