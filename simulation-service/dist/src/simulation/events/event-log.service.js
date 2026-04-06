"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogService = void 0;
const common_1 = require("@nestjs/common");
let EventLogService = class EventLogService {
    events = [];
    MAX_EVENTS = 100;
    record(type, scenarioId) {
        this.events.push({
            type,
            scenarioId,
            timestamp: Date.now(),
        });
        if (this.events.length > this.MAX_EVENTS) {
            this.events = this.events.slice(-this.MAX_EVENTS);
        }
    }
    getEvents(sinceMs) {
        if (sinceMs) {
            const cutoff = Date.now() - sinceMs;
            return this.events.filter((e) => e.timestamp >= cutoff);
        }
        return [...this.events];
    }
};
exports.EventLogService = EventLogService;
exports.EventLogService = EventLogService = __decorate([
    (0, common_1.Injectable)()
], EventLogService);
//# sourceMappingURL=event-log.service.js.map