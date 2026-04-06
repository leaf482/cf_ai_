"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributionIndex = void 0;
class AttributionIndex {
    index = new Map();
    add(videoId, scenarioId) {
        let set = this.index.get(videoId);
        if (!set) {
            set = new Set();
            this.index.set(videoId, set);
        }
        set.add(scenarioId);
    }
    remove(videoId, scenarioId) {
        const set = this.index.get(videoId);
        if (set) {
            set.delete(scenarioId);
            if (set.size === 0)
                this.index.delete(videoId);
        }
    }
    getScenarioIds(videoId) {
        return Array.from(this.index.get(videoId) ?? []);
    }
    removeScenario(scenarioId, videoId) {
        this.remove(videoId, scenarioId);
    }
    setScenarioVideo(scenarioId, videoId) {
        this.add(videoId, scenarioId);
    }
    clearScenario(scenarioId, videoId) {
        this.remove(videoId, scenarioId);
    }
    getAll() {
        const out = new Map();
        for (const [videoId, set] of this.index) {
            out.set(videoId, Array.from(set));
        }
        return out;
    }
}
exports.AttributionIndex = AttributionIndex;
//# sourceMappingURL=attribution-index.js.map