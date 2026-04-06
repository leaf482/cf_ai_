"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSession = createUserSession;
function createUserSession(input) {
    const prefix = input.sessionPrefix ?? 'sim';
    const intervalMs = input.heartbeatIntervalMs;
    return {
        userId: input.userId,
        sessionId: `${prefix}-${input.userId}-${Math.random().toString(36).slice(2, 8)}`,
        videoId: input.videoId,
        watchDurationMs: input.watchDurationMs,
        playheadMs: 0,
        lastHeartbeatAt: input.nowMs,
        heartbeatIntervalMs: intervalMs,
        nextHeartbeatDueAt: input.nowMs + intervalMs,
    };
}
//# sourceMappingURL=user-session.js.map