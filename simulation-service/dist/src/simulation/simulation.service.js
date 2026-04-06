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
var SimulationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationService = void 0;
const common_1 = require("@nestjs/common");
const load_test_phases_1 = require("./engine/load-test-phases");
const master_tick_scheduler_1 = require("./engine/master-tick-scheduler");
const scenario_registry_1 = require("./engine/scenario-registry");
const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);
function toScenarioConfig(scenario) {
    const durationSec = scenario.duration_seconds;
    const pool = scenario.video_ids && scenario.video_ids.length > 0
        ? [...scenario.video_ids]
        : [...DEFAULT_VIDEO_IDS];
    return {
        baseTraffic: { lambdaUsersPerSecond: Math.max(0, scenario.users ?? 0) },
        injection: { type: 'none' },
        videoPool: pool,
        zipfSkew: 1.1,
        durationTicks: durationSec ? durationSec * 10 : undefined,
    };
}
let SimulationService = SimulationService_1 = class SimulationService {
    scheduler;
    registry;
    logger = new common_1.Logger(SimulationService_1.name);
    loadTestPhaseIndex = 0;
    loadTestTimeoutId = null;
    constructor(scheduler, registry) {
        this.scheduler = scheduler;
        this.registry = registry;
    }
    onModuleInit() {
        this.scheduler.start();
    }
    start(scenario) {
        const running = this.registry.getRunning();
        if (running.length > 0) {
            throw new common_1.ConflictException('A simulation is already running');
        }
        const config = toScenarioConfig(scenario);
        const scenarioId = `run-${Date.now().toString(36)}`;
        this.scheduler.enqueueStart(scenarioId, scenario.name, config);
        return {
            run_id: scenarioId,
            running: true,
            scenario,
            sent: 0,
            errors: 0,
            started_at: new Date(),
        };
    }
    startByScenarioId(scenarioId) {
        if (scenarioId === 'load_test') {
            return this.runLoadTest();
        }
        const template = this.registry.getTemplate(scenarioId);
        if (!template) {
            throw new common_1.ConflictException(`Unknown scenario: ${scenarioId}`);
        }
        const running = this.registry.getRunning();
        if (running.some((s) => s.id === scenarioId)) {
            throw new common_1.ConflictException(`Scenario ${scenarioId} is already running`);
        }
        const config = {
            ...template.config,
            durationTicks: template.duration_seconds
                ? template.duration_seconds * 10
                : undefined,
        };
        this.scheduler.enqueueStart(scenarioId, template.name, config);
        return {
            run_id: scenarioId,
            running: true,
            scenario: null,
            sent: 0,
            errors: 0,
            started_at: new Date(),
        };
    }
    runLoadTest() {
        const running = this.registry.getRunning();
        if (running.length > 0) {
            throw new common_1.ConflictException('A simulation is already running');
        }
        this.loadTestPhaseIndex = 0;
        const phase = load_test_phases_1.LOAD_TEST_PHASES[0];
        const scenario = (0, load_test_phases_1.phaseToScenario)(phase);
        const config = toScenarioConfig(scenario);
        this.scheduler.enqueueStart('load_test', phase.name, config);
        this.scheduleLoadTestNextPhase();
        return {
            run_id: 'load_test',
            running: true,
            scenario,
            sent: 0,
            errors: 0,
            started_at: new Date(),
        };
    }
    scheduleLoadTestNextPhase() {
        this.loadTestTimeoutId = setTimeout(() => {
            this.loadTestTimeoutId = null;
            const s = this.registry.get('load_test');
            if (!s)
                return;
            this.scheduler.enqueueStop('load_test');
            this.loadTestPhaseIndex++;
            if (this.loadTestPhaseIndex >= load_test_phases_1.LOAD_TEST_PHASES.length) {
                this.logger.log(`load_test complete — emitted=${s.stats.emittedEvents}`);
                return;
            }
            setTimeout(() => {
                const phase = load_test_phases_1.LOAD_TEST_PHASES[this.loadTestPhaseIndex];
                const scenario = (0, load_test_phases_1.phaseToScenario)(phase);
                const config = toScenarioConfig(scenario);
                config.durationTicks = phase.duration_seconds * 10;
                this.scheduler.enqueueSwitchPhase('load_test', config);
                this.logger.log(`load_test ${phase.name} (${phase.users} users, ${phase.duration_seconds}s)`);
                this.scheduleLoadTestNextPhase();
            }, load_test_phases_1.COOLDOWN_MS);
        }, (0, load_test_phases_1.getPhaseDurationMs)(load_test_phases_1.LOAD_TEST_PHASES[this.loadTestPhaseIndex]));
    }
    stop() {
        const running = this.registry.getRunning();
        for (const s of running) {
            this.scheduler.enqueueStop(s.id);
        }
        if (this.loadTestTimeoutId) {
            clearTimeout(this.loadTestTimeoutId);
            this.loadTestTimeoutId = null;
        }
        const totalEmitted = running.reduce((a, s) => a + s.stats.emittedEvents, 0);
        this.logger.log(`stopped — total emitted=${totalEmitted}`);
        return {
            running: false,
            scenario: null,
            sent: totalEmitted,
            errors: 0,
            started_at: null,
        };
    }
    getStatus() {
        const running = this.registry.getRunning();
        const paused = this.registry.getAll().filter((s) => s.status === 'paused');
        const totalEmitted = this.registry
            .getAll()
            .reduce((a, s) => a + s.stats.emittedEvents, 0);
        const firstRunning = running[0];
        return {
            run_id: firstRunning?.id ?? '',
            running: running.length > 0,
            paused: paused.length > 0 && running.length === 0,
            scenario: null,
            sent: totalEmitted,
            errors: 0,
            started_at: null,
        };
    }
    pause() {
        const running = this.registry.getRunning();
        for (const s of running) {
            this.scheduler.enqueuePause(s.id);
        }
        this.logger.log('simulation paused');
    }
    resume() {
        const paused = this.registry.getAll().filter((s) => s.status === 'paused');
        for (const s of paused) {
            this.scheduler.enqueueResume(s.id);
        }
        this.logger.log('simulation resumed');
    }
    injectSpike(users = 3000, durationSec = 5) {
        this.scheduler.enqueueStart('spike-overlay', `Spike +${users}`, {
            baseTraffic: { lambdaUsersPerSecond: 0 },
            injection: {
                type: 'viral_spike',
                targetVideoId: DEFAULT_VIDEO_IDS[0],
                totalUsers: users,
                durationMs: durationSec * 1000,
            },
            videoPool: [...DEFAULT_VIDEO_IDS],
            zipfSkew: 1.2,
        });
        setTimeout(() => {
            this.scheduler.enqueueStop('spike-overlay');
        }, durationSec * 1000);
    }
};
exports.SimulationService = SimulationService;
exports.SimulationService = SimulationService = SimulationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [master_tick_scheduler_1.MasterTickScheduler,
        scenario_registry_1.ScenarioRegistry])
], SimulationService);
//# sourceMappingURL=simulation.service.js.map