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
var ScenarioStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioStrategy = void 0;
const common_1 = require("@nestjs/common");
const load_strategy_1 = require("./load.strategy");
let ScenarioStrategy = ScenarioStrategy_1 = class ScenarioStrategy {
    load;
    logger = new common_1.Logger(ScenarioStrategy_1.name);
    constructor(load) {
        this.load = load;
    }
    run(targetUrl, scenario) {
        let stopped = false;
        let tickCallback = null;
        const playheads = new Map();
        const allUserIds = Array.from({ length: scenario.users }, (_, i) => `user-${i + 1}`);
        const usersPerRampStep = Math.max(1, Math.floor(scenario.users / Math.max(scenario.ramp_up_seconds, 1)));
        const loop = async () => {
            let activeUsers = 0;
            let elapsed = 0;
            while (!stopped) {
                const tickStart = Date.now();
                if (elapsed < scenario.ramp_up_seconds) {
                    activeUsers = Math.min(activeUsers + usersPerRampStep, scenario.users);
                    this.logger.debug(`ramp-up: ${activeUsers}/${scenario.users} users active`);
                }
                else {
                    activeUsers = scenario.users;
                }
                if (activeUsers > 0) {
                    const eventsThisTick = Math.round(activeUsers * scenario.events_per_second);
                    const concurrency = Math.min(eventsThisTick, 50);
                    const activeUserIds = allUserIds.slice(0, activeUsers);
                    const { sent, errors } = await this.load.sendBurst(targetUrl, scenario, activeUserIds, playheads, eventsThisTick, concurrency);
                    tickCallback?.(sent, errors);
                    this.logger.debug(`tick ${elapsed}s: sent=${sent} errors=${errors}`);
                }
                elapsed++;
                if (scenario.duration_seconds && elapsed >= scenario.duration_seconds) {
                    this.logger.log('simulation duration reached, stopping');
                    stopped = true;
                    break;
                }
                const elapsed_ms = Date.now() - tickStart;
                const remaining = Math.max(0, 1000 - elapsed_ms);
                await new Promise((r) => setTimeout(r, remaining));
            }
        };
        void loop();
        return {
            stop: () => {
                stopped = true;
            },
            onTick: (cb) => {
                tickCallback = cb;
            },
        };
    }
};
exports.ScenarioStrategy = ScenarioStrategy;
exports.ScenarioStrategy = ScenarioStrategy = ScenarioStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [load_strategy_1.LoadStrategy])
], ScenarioStrategy);
//# sourceMappingURL=scenario.strategy.js.map