/**
 * Simulation Server - Central Engine
 *
 * This module orchestrates:
 * - Scenario Registry: Normal, Spike, Slowdown load patterns
 * - Master Tick Scheduler: 100ms period single setInterval loop
 * - Task Manager: Per-tick Heartbeat batch calculation → Core API
 * - Run Manager: run_id issuance and run state
 *
 * Entry: NestJS SimulationModule wires SimulationService, which drives
 * MasterTickScheduler on module init. Use SimulationController for HTTP API.
 */

export * from './engine/scenario-registry';
export * from './engine/run-manager';
export * from './engine/task-manager';
export * from './engine/master-tick-scheduler';
