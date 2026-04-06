"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStreamService = void 0;
const common_1 = require("@nestjs/common");
const MAX_EVENTS = 10;
let EventStreamService = class EventStreamService {
    events = [];
    push(userId, videoId) {
        this.events.unshift({
            userId,
            videoId,
            timestamp: Date.now(),
        });
        if (this.events.length > MAX_EVENTS) {
            this.events = this.events.slice(0, MAX_EVENTS);
        }
    }
    pushBatch(payloads) {
        for (const p of payloads) {
            this.push(p.user_id, p.video_id);
        }
    }
    getEvents() {
        return [...this.events];
    }
};
exports.EventStreamService = EventStreamService;
exports.EventStreamService = EventStreamService = __decorate([
    (0, common_1.Injectable)()
], EventStreamService);
//# sourceMappingURL=event-stream.service.js.map