"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandQueue = void 0;
class CommandQueue {
    queue = [];
    enqueue(cmd) {
        this.queue.push(cmd);
    }
    drain() {
        const applied = new Map();
        for (const cmd of this.queue) {
            const existing = applied.get(cmd.scenarioId);
            const merged = this.coalesce(existing, cmd);
            if (merged)
                applied.set(cmd.scenarioId, merged);
        }
        this.queue = [];
        return Array.from(applied.values());
    }
    coalesce(existing, incoming) {
        if (!existing)
            return incoming;
        switch (incoming.command) {
            case 'start':
                return incoming;
            case 'stop':
                return { ...incoming };
            case 'pause':
                if (existing.command === 'stop')
                    return null;
                if (existing.command === 'start') {
                    return { ...existing, initialStatus: 'paused' };
                }
                return { ...incoming };
            case 'resume':
                if (existing.command === 'stop')
                    return null;
                if (existing.command === 'start')
                    return existing;
                return { ...incoming };
            case 'switch_phase':
                return incoming.config ? { ...incoming } : null;
            default:
                return incoming;
        }
    }
    isEmpty() {
        return this.queue.length === 0;
    }
}
exports.CommandQueue = CommandQueue;
//# sourceMappingURL=command-queue.js.map