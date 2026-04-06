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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactoryService = void 0;
const common_1 = require("@nestjs/common");
const master_tick_scheduler_1 = require("../engine/master-tick-scheduler");
const scenario_registry_1 = require("../engine/scenario-registry");
const attribution_index_1 = require("../engine/attribution-index");
const event_log_service_1 = require("../events/event-log.service");
const presets_constants_1 = require("./presets.constants");
const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);
let FactoryService = class FactoryService {
    scheduler;
    registry;
    attributionIndex;
    eventLog;
    constructor(scheduler, registry, attributionIndex, eventLog) {
        this.scheduler = scheduler;
        this.registry = registry;
        this.attributionIndex = attributionIndex;
        this.eventLog = eventLog;
    }
    createAndStart(dto) {
        const scenarioId = `scenario-${Date.now().toString(36)}`;
        let users;
        let durationSeconds;
        let name;
        let presetId;
        if (dto.presetId) {
            const preset = (0, presets_constants_1.getPreset)(dto.presetId);
            if (!preset) {
                throw new common_1.NotFoundException(`Preset '${dto.presetId}' not found`);
            }
            users = dto.users ?? preset.users;
            durationSeconds = dto.durationSeconds ?? preset.durationSeconds;
            name = dto.name?.trim() || preset.name;
            presetId = preset.id;
        }
        else {
            users = dto.users ?? 100;
            durationSeconds = dto.durationSeconds;
            name = dto.name?.trim() || `Scenario ${Date.now().toString(36)}`;
        }
        const videoId = dto.targetVideoId ?? DEFAULT_VIDEO_IDS[0];
        const videoPool = [
            videoId,
            ...DEFAULT_VIDEO_IDS.filter((v) => v !== videoId),
        ];
        const baseLambda = presetId && (presetId === 'hot_trending' || presetId === 'viral_spike')
            ? 20
            : Math.max(0, users);
        const config = {
            baseTraffic: { lambdaUsersPerSecond: baseLambda },
            injection: { type: 'none' },
            videoPool,
            zipfSkew: 1.2,
            durationTicks: durationSeconds ? durationSeconds * 10 : undefined,
        };
        if (presetId === 'hot_trending') {
            config.injection = {
                type: 'hot_trending',
                targetVideoId: videoId,
                totalUsers: Math.max(0, users),
                durationMs: 30_000,
            };
            config.watchDurationDistribution = [
                { seconds: 3, weight: 15 },
                { seconds: 10, weight: 30 },
                { seconds: 30, weight: 35 },
                { seconds: 60, weight: 20 },
            ];
        }
        else if (presetId === 'viral_spike') {
            config.injection = {
                type: 'viral_spike',
                targetVideoId: videoId,
                totalUsers: Math.max(0, users),
                durationMs: 5_000,
            };
            config.watchDurationDistribution = [
                { seconds: 3, weight: 70 },
                { seconds: 10, weight: 25 },
                { seconds: 30, weight: 4 },
                { seconds: 60, weight: 1 },
            ];
        }
        else if (presetId === 'half_hot_trending' ||
            presetId === 'noise_traffic') {
            config.watchDurationDistribution = [{ seconds: 3, weight: 100 }];
        }
        else if (presetId === 'long_engagement') {
            config.watchDurationDistribution = [
                { seconds: 3, weight: 5 },
                { seconds: 10, weight: 20 },
                { seconds: 30, weight: 45 },
                { seconds: 60, weight: 30 },
            ];
        }
        this.scheduler.enqueueStart(scenarioId, name, config);
        return {
            id: scenarioId,
            name,
            config,
            message: 'Scenario created and started',
        };
    }
    listActive() {
        const scenarios = this.registry
            .getAll()
            .filter((s) => s.status !== 'stopped');
        return scenarios.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            config: s.config,
            stats: {
                emittedEvents: s.stats.emittedEvents,
                activeUsers: s.activeUsers,
                elapsedTicks: s.elapsedTicks,
            },
        }));
    }
    patchScenario(id, action) {
        const scenario = this.registry.get(id);
        if (!scenario) {
            throw new common_1.NotFoundException(`Scenario ${id} not found`);
        }
        switch (action) {
            case 'pause':
                this.scheduler.enqueuePause(id);
                return { id, action: 'paused' };
            case 'resume':
                this.scheduler.enqueueResume(id);
                return { id, action: 'resumed' };
            case 'spike':
                if (scenario.status !== 'running') {
                    throw new common_1.NotFoundException(`Spike only applies to running scenarios (${id} is ${scenario.status})`);
                }
                this.scheduler.enqueueSpike(id, 5, 5000);
                this.eventLog.record('spike', id);
                return { id, action: 'spike_injected' };
            case 'stop':
                this.scheduler.enqueueStop(id);
                this.eventLog.record('stop', id);
                return { id, action: 'stopped' };
            default:
                throw new common_1.NotFoundException('Unknown action');
        }
    }
    getAttribution() {
        const all = this.attributionIndex.getAll();
        const out = {};
        for (const [videoId, scenarioIds] of all) {
            const names = scenarioIds
                .map((id) => this.registry.get(id)?.name ?? id)
                .filter(Boolean);
            if (names.length > 0)
                out[videoId] = names;
        }
        return out;
    }
    getAttributionDetail() {
        const all = this.attributionIndex.getAll();
        const out = {};
        for (const [videoId, scenarioIds] of all) {
            const details = scenarioIds
                .map((id) => {
                const s = this.registry.get(id);
                if (!s)
                    return null;
                const elapsedSec = s.elapsedTicks * 0.1 || 1;
                return {
                    scenarioId: id,
                    scenarioName: s.name,
                    emittedCount: s.stats.emittedEvents,
                    activeViewers: s.activeUsers,
                    hps: s.stats.emittedEvents / elapsedSec,
                };
            })
                .filter(Boolean);
            if (details.length > 0)
                out[videoId] = details;
        }
        return out;
    }
};
exports.FactoryService = FactoryService;
exports.FactoryService = FactoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [master_tick_scheduler_1.MasterTickScheduler,
        scenario_registry_1.ScenarioRegistry,
        attribution_index_1.AttributionIndex,
        event_log_service_1.EventLogService])
], FactoryService);
//# sourceMappingURL=factory.service.js.map