"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChaosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaosService = void 0;
const common_1 = require("@nestjs/common");
const master_tick_scheduler_1 = require("../engine/master-tick-scheduler");
const scenario_registry_1 = require("../engine/scenario-registry");
const event_log_service_1 = require("../events/event-log.service");
const LOAD_SPIKE_MULTIPLIER = 5;
const LOAD_SPIKE_DURATION_MS = 5000;
let ChaosService = ChaosService_1 = class ChaosService {
    scheduler;
    registry;
    eventLog;
    logger = new common_1.Logger(ChaosService_1.name);
    pausedWorkers = new Set();
    constructor(scheduler, registry, eventLog) {
        this.scheduler = scheduler;
        this.registry = registry;
        this.eventLog = eventLog;
    }
    pauseWorker(workerId) {
        this.pausedWorkers.add(workerId);
        this.logger.log(`worker ${workerId} marked as paused (logical)`);
        return {
            workerId,
            status: 'paused',
            message: 'Worker is logically paused. Resume via worker API when implemented.',
        };
    }
    resumeWorker(workerId) {
        this.pausedWorkers.delete(workerId);
        this.logger.log(`worker ${workerId} resumed`);
        return { workerId, status: 'resumed' };
    }
    isWorkerPaused(workerId) {
        return this.pausedWorkers.has(workerId);
    }
    getPausedWorkers() {
        return Array.from(this.pausedWorkers);
    }
    triggerLoadSpike() {
        this.scheduler.enqueueLoadSpike(LOAD_SPIKE_MULTIPLIER, LOAD_SPIKE_DURATION_MS);
        this.eventLog.record('load_spike');
        this.logger.log(`load spike: ${LOAD_SPIKE_MULTIPLIER}x for ${LOAD_SPIKE_DURATION_MS}ms`);
        return {
            message: `Load spike applied: ${LOAD_SPIKE_MULTIPLIER}x for 5 seconds`,
            multiplier: LOAD_SPIKE_MULTIPLIER,
            durationMs: LOAD_SPIKE_DURATION_MS,
        };
    }
};
exports.ChaosService = ChaosService;
exports.ChaosService = ChaosService = ChaosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [master_tick_scheduler_1.MasterTickScheduler,
        scenario_registry_1.ScenarioRegistry,
        event_log_service_1.EventLogService])
], ChaosService);
//# sourceMappingURL=chaos.service.js.map