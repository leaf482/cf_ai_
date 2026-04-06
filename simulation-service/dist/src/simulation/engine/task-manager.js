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
exports.TaskManager = void 0;
const common_1 = require("@nestjs/common");
const load_strategy_1 = require("../strategies/load.strategy");
const TICK_MS = 100;
const TICKS_PER_SECOND = 1000 / TICK_MS;
let TaskManager = class TaskManager {
    loadStrategy;
    constructor(loadStrategy) {
        this.loadStrategy = loadStrategy;
    }
    computeBatchSize(activeUsers, eventsPerSecond) {
        const eventsPerTick = (activeUsers * eventsPerSecond) / TICKS_PER_SECOND;
        return Math.round(eventsPerTick);
    }
    async executeTick(config, playheads) {
        const activeUsers = config.getActiveUsers();
        if (activeUsers <= 0)
            return { sent: 0, errors: 0 };
        const batchSize = this.computeBatchSize(activeUsers, config.scenario.events_per_second);
        if (batchSize <= 0)
            return { sent: 0, errors: 0 };
        const allUserIds = Array.from({ length: config.scenario.users }, (_, i) => `user-${i + 1}`);
        const activeUserIds = allUserIds.slice(0, activeUsers);
        const concurrency = Math.min(batchSize, 50);
        return this.loadStrategy.sendBurst(config.targetUrl, config.scenario, activeUserIds, playheads, batchSize, concurrency);
    }
};
exports.TaskManager = TaskManager;
exports.TaskManager = TaskManager = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [load_strategy_1.LoadStrategy])
], TaskManager);
//# sourceMappingURL=task-manager.js.map