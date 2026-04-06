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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LoadStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadStrategy = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const p_limit_1 = __importDefault(require("p-limit"));
const rxjs_1 = require("rxjs");
let LoadStrategy = LoadStrategy_1 = class LoadStrategy {
    http;
    logger = new common_1.Logger(LoadStrategy_1.name);
    constructor(http) {
        this.http = http;
    }
    async sendBurst(targetUrl, scenario, userIds, playheads, count, concurrency) {
        const limit = (0, p_limit_1.default)(concurrency);
        let sent = 0;
        let errors = 0;
        const tasks = Array.from({ length: count }, (_, i) => {
            const userId = userIds[i % userIds.length];
            const videoId = scenario.video_ids[Math.floor(Math.random() * scenario.video_ids.length)];
            const prev = playheads.get(userId) ?? 0;
            const next = prev + scenario.watch_seconds * 1000;
            playheads.set(userId, next);
            const payload = {
                session_id: `sim-${userId}`,
                user_id: userId,
                video_id: videoId,
                playhead: next,
                timestamp: Date.now(),
            };
            return limit(async () => {
                try {
                    await (0, rxjs_1.firstValueFrom)(this.http.post(targetUrl, payload));
                    sent++;
                }
                catch (err) {
                    errors++;
                    const msg = err instanceof Error ? err.message : String(err);
                    this.logger.warn(`send error: ${msg}`);
                }
            });
        });
        await Promise.all(tasks);
        return { sent, errors };
    }
};
exports.LoadStrategy = LoadStrategy;
exports.LoadStrategy = LoadStrategy = LoadStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], LoadStrategy);
//# sourceMappingURL=load.strategy.js.map