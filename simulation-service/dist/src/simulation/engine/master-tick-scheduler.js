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
var MasterTickScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterTickScheduler = void 0;
const common_1 = require("@nestjs/common");
const scenario_registry_1 = require("./scenario-registry");
const command_queue_1 = require("./command-queue");
const attribution_index_1 = require("./attribution-index");
const batch_sender_1 = require("./batch-sender");
const event_log_service_1 = require("../events/event-log.service");
const event_stream_service_1 = require("../events/event-stream.service");
const sampling_1 = require("./sampling");
const user_session_1 = require("./user-session");
const TICK_MS = 100;
const DEFAULT_API_URL = process.env.RANKING_API_URL ?? 'http://localhost:8080/v1/heartbeat';
let MasterTickScheduler = MasterTickScheduler_1 = class MasterTickScheduler {
    registry;
    commandQueue;
    attributionIndex;
    batchSender;
    eventLog;
    eventStream;
    logger = new common_1.Logger(MasterTickScheduler_1.name);
    intervalId = null;
    lastTickAtMs = 0;
    constructor(registry, commandQueue, attributionIndex, batchSender, eventLog, eventStream) {
        this.registry = registry;
        this.commandQueue = commandQueue;
        this.attributionIndex = attributionIndex;
        this.batchSender = batchSender;
        this.eventLog = eventLog;
        this.eventStream = eventStream;
    }
    onModuleDestroy() {
        this.stop();
    }
    start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => void this.tick(), TICK_MS);
        this.logger.log('Master tick scheduler started (100ms period)');
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.logger.log('Master tick scheduler stopped');
    }
    enqueueStart(scenarioId, name, config) {
        this.commandQueue.enqueue({
            scenarioId,
            command: 'start',
            name,
            config,
        });
    }
    enqueuePause(scenarioId) {
        this.commandQueue.enqueue({ scenarioId, command: 'pause' });
    }
    enqueueResume(scenarioId) {
        this.commandQueue.enqueue({ scenarioId, command: 'resume' });
    }
    enqueueStop(scenarioId) {
        this.commandQueue.enqueue({ scenarioId, command: 'stop' });
    }
    enqueueSwitchPhase(scenarioId, config) {
        this.commandQueue.enqueue({
            scenarioId,
            command: 'switch_phase',
            config,
        });
    }
    enqueueSpike(scenarioId, multiplier, durationMs) {
        const s = this.registry.get(scenarioId);
        if (s)
            this.registry.setSpike(scenarioId, multiplier, durationMs);
    }
    enqueueLoadSpike(multiplier, durationMs) {
        this.registry.setSpikeAll(multiplier, durationMs);
    }
    applyCommands(commands) {
        for (const cmd of commands) {
            switch (cmd.command) {
                case 'start':
                    if (cmd.config && cmd.name) {
                        const existing = this.registry.get(cmd.scenarioId);
                        if (existing) {
                            const oldTarget = existing.config.injection?.targetVideoId ??
                                existing.config.videoPool?.[0];
                            if (oldTarget)
                                this.attributionIndex.clearScenario(cmd.scenarioId, oldTarget);
                        }
                        this.registry.create(cmd.scenarioId, cmd.name, cmd.config);
                        if (cmd.initialStatus === 'paused') {
                            this.registry.setStatus(cmd.scenarioId, 'paused');
                        }
                        const target = cmd.config.injection?.targetVideoId ?? cmd.config.videoPool?.[0];
                        if (target)
                            this.attributionIndex.setScenarioVideo(cmd.scenarioId, target);
                        this.eventLog.record('start', cmd.scenarioId);
                        const durationSeconds = cmd.config.durationTicks
                            ? (cmd.config.durationTicks * TICK_MS) / 1000
                            : undefined;
                        this.logger.log(`scenario started id=${cmd.scenarioId} name="${cmd.name}" lambda=${cmd.config.baseTraffic?.lambdaUsersPerSecond ?? 0}` +
                            ` durationSec=${durationSeconds ?? '∞'}${cmd.initialStatus === 'paused' ? ' [paused]' : ''}`);
                    }
                    break;
                case 'pause':
                    this.registry.setStatus(cmd.scenarioId, 'paused');
                    this.eventLog.record('pause', cmd.scenarioId);
                    this.logger.debug(`paused ${cmd.scenarioId}`);
                    break;
                case 'resume':
                    this.registry.setStatus(cmd.scenarioId, 'running');
                    this.eventLog.record('resume', cmd.scenarioId);
                    this.logger.debug(`resumed ${cmd.scenarioId}`);
                    break;
                case 'stop': {
                    const s = this.registry.get(cmd.scenarioId);
                    if (s) {
                        const target = s.config.injection?.targetVideoId ?? s.config.videoPool?.[0];
                        if (target)
                            this.attributionIndex.clearScenario(cmd.scenarioId, target);
                        this.registry.setStatus(cmd.scenarioId, 'stopped');
                        this.registry.remove(cmd.scenarioId);
                        this.eventLog.record('stop', cmd.scenarioId);
                        this.logger.log(`stopped ${cmd.scenarioId}`);
                    }
                    break;
                }
                case 'switch_phase': {
                    if (cmd.config) {
                        const existing = this.registry.get(cmd.scenarioId);
                        if (existing) {
                            const oldTarget = existing.config.injection?.targetVideoId ??
                                existing.config.videoPool?.[0];
                            if (oldTarget)
                                this.attributionIndex.clearScenario(cmd.scenarioId, oldTarget);
                        }
                        this.registry.updateConfig(cmd.scenarioId, cmd.config);
                        const newTarget = cmd.config.injection?.targetVideoId ?? cmd.config.videoPool?.[0];
                        if (newTarget)
                            this.attributionIndex.setScenarioVideo(cmd.scenarioId, newTarget);
                        this.logger.log(`switch_phase ${cmd.scenarioId} (lambda=${cmd.config.baseTraffic?.lambdaUsersPerSecond ?? 0})`);
                    }
                    break;
                }
            }
        }
    }
    isSpikeActive(scenario, nowMs) {
        if (scenario.loadMultiplier &&
            scenario.spikeEndMs &&
            nowMs < scenario.spikeEndMs)
            return true;
        if (scenario.spikeEndMs && nowMs >= scenario.spikeEndMs) {
            scenario.loadMultiplier = undefined;
            scenario.spikeEndMs = undefined;
        }
        return false;
    }
    scenarioRng() {
        return Math.random;
    }
    createSessionsForScenario(scenario, count, nowMs, opts) {
        if (count <= 0)
            return [];
        const rng = this.scenarioRng();
        const skew = scenario.config.zipfSkew ?? 1.1;
        const pool = scenario.config.videoPool;
        const popularity = scenario.config.videoPopularity;
        const selector = popularity && popularity.length > 0
            ? {
                pick: () => (0, sampling_1.sampleWeighted)(rng, popularity.map((p) => ({ value: p.videoId, weight: p.weight }))),
            }
            : (0, sampling_1.buildZipfSelector)(rng, pool, skew);
        const sampler = (0, sampling_1.buildWatchDurationSampler)(rng, opts?.watchDurationDistribution ??
            scenario.config.watchDurationDistribution);
        const sessions = [];
        for (let i = 0; i < count; i++) {
            const userId = `${scenario.id}-u${++scenario.userSeq}`;
            const videoId = opts?.forceVideoId ?? selector.pick();
            const watchDurationMs = sampler.sample();
            sessions.push((0, user_session_1.createUserSession)({
                userId,
                videoId,
                watchDurationMs,
                nowMs,
                heartbeatIntervalMs: scenario.config.heartbeatIntervalMs ?? 500,
                sessionPrefix: 'sim',
            }));
        }
        return sessions;
    }
    generateArrivals(scenario, nowMs) {
        const rng = this.scenarioRng();
        const spikeActive = this.isSpikeActive(scenario, nowMs);
        const multiplier = spikeActive ? (scenario.loadMultiplier ?? 1) : 1;
        const baseLambda = (scenario.config.baseTraffic?.lambdaUsersPerSecond ?? 0) * multiplier;
        const baseArrivals = (0, sampling_1.samplePoisson)(rng, baseLambda);
        let injectedArrivals = 0;
        const inj = scenario.config.injection;
        const sinceStartMs = nowMs - scenario.startedAtMs;
        if (inj && inj.type !== 'none') {
            const durationMs = Math.max(0, inj.durationMs ?? 0);
            const totalUsers = Math.max(0, inj.totalUsers ?? 0);
            if (durationMs > 0 &&
                totalUsers > 0 &&
                sinceStartMs >= 0 &&
                sinceStartMs < durationMs) {
                const lambda = (totalUsers / (durationMs / 1000)) * multiplier;
                injectedArrivals = (0, sampling_1.samplePoisson)(rng, lambda);
            }
        }
        const sessions = [];
        sessions.push(...this.createSessionsForScenario(scenario, baseArrivals, nowMs));
        if (injectedArrivals > 0 && inj) {
            if (inj.type === 'hot_trending') {
                sessions.push(...this.createSessionsForScenario(scenario, injectedArrivals, nowMs, {
                    forceVideoId: inj.targetVideoId,
                    watchDurationDistribution: [
                        { seconds: 3, weight: 20 },
                        { seconds: 10, weight: 30 },
                        { seconds: 30, weight: 30 },
                        { seconds: 60, weight: 20 },
                    ],
                }));
            }
            else if (inj.type === 'viral_spike') {
                sessions.push(...this.createSessionsForScenario(scenario, injectedArrivals, nowMs, {
                    forceVideoId: inj.targetVideoId,
                    watchDurationDistribution: [
                        { seconds: 3, weight: 70 },
                        { seconds: 10, weight: 25 },
                        { seconds: 30, weight: 4 },
                        { seconds: 60, weight: 1 },
                    ],
                }));
            }
        }
        return sessions;
    }
    updateSessionsAndBuildHeartbeats(scenario, nowMs, elapsedMs) {
        const payloads = [];
        const toDelete = [];
        for (const [userId, session] of scenario.sessions) {
            const nextPlayhead = session.playheadMs + elapsedMs;
            session.playheadMs = nextPlayhead;
            if (session.playheadMs >= session.watchDurationMs) {
                toDelete.push(userId);
                continue;
            }
            if (nowMs >= session.nextHeartbeatDueAt) {
                payloads.push({
                    session_id: session.sessionId,
                    user_id: session.userId,
                    video_id: session.videoId,
                    playhead: session.playheadMs,
                    timestamp: nowMs,
                });
                session.lastHeartbeatAt = nowMs;
                do {
                    session.nextHeartbeatDueAt += session.heartbeatIntervalMs;
                } while (nowMs >= session.nextHeartbeatDueAt);
            }
        }
        for (const userId of toDelete) {
            scenario.sessions.delete(userId);
        }
        scenario.activeUsers = scenario.sessions.size;
        return payloads;
    }
    async tick() {
        const nowMs = Date.now();
        if (this.lastTickAtMs === 0)
            this.lastTickAtMs = nowMs;
        const elapsedMs = Math.max(0, Math.min(nowMs - this.lastTickAtMs, 1000));
        this.lastTickAtMs = nowMs;
        const commands = this.commandQueue.drain();
        if (commands.length > 0) {
            this.applyCommands(commands);
        }
        const running = this.registry.getRunning();
        if (running.length === 0)
            return;
        const allPayloads = [];
        const countsPerScenario = new Map();
        for (const scenario of running) {
            scenario.elapsedTicks++;
            if (scenario.config.durationTicks &&
                scenario.elapsedTicks >= scenario.config.durationTicks) {
                const target = scenario.config.injection?.targetVideoId ??
                    scenario.config.videoPool?.[0];
                if (target)
                    this.attributionIndex.clearScenario(scenario.id, target);
                this.registry.remove(scenario.id);
                this.logger.log(`scenario ${scenario.id} duration reached, stopped`);
                continue;
            }
            if (scenario.elapsedTicks % 10 === 0) {
                const maxSessions = scenario.config.maxConcurrentSessions ?? 20_000;
                if (scenario.sessions.size < maxSessions) {
                    const arrivals = this.generateArrivals(scenario, nowMs);
                    for (const sess of arrivals) {
                        if (scenario.sessions.size >= maxSessions)
                            break;
                        scenario.sessions.set(sess.userId, sess);
                    }
                }
            }
            const payloads = this.updateSessionsAndBuildHeartbeats(scenario, nowMs, elapsedMs);
            if (payloads.length > 0) {
                allPayloads.push(...payloads);
                countsPerScenario.set(scenario.id, payloads.length);
            }
        }
        if (allPayloads.length > 0) {
            this.eventStream.pushBatch(allPayloads.map((p) => ({ user_id: p.user_id, video_id: p.video_id })));
            const { sent } = await this.batchSender.sendBatch(allPayloads, DEFAULT_API_URL);
            const ratio = sent / allPayloads.length;
            for (const [id, count] of countsPerScenario) {
                const s = this.registry.get(id);
                if (s)
                    s.stats.emittedEvents += Math.round(count * ratio);
            }
        }
    }
    getRegistry() {
        return this.registry;
    }
};
exports.MasterTickScheduler = MasterTickScheduler;
exports.MasterTickScheduler = MasterTickScheduler = MasterTickScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [scenario_registry_1.ScenarioRegistry,
        command_queue_1.CommandQueue,
        attribution_index_1.AttributionIndex,
        batch_sender_1.BatchSender,
        event_log_service_1.EventLogService,
        event_stream_service_1.EventStreamService])
], MasterTickScheduler);
//# sourceMappingURL=master-tick-scheduler.js.map