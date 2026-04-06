"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENARIO_PRESETS = void 0;
exports.getPreset = getPreset;
exports.listPresets = listPresets;
exports.SCENARIO_PRESETS = [
    {
        id: 'hot_trending',
        name: 'Hot Trending',
        description: 'High engagement, 10s watch',
        users: 10,
        watchSeconds: 10,
        intervalMs: 500,
        durationSeconds: 120,
        scoreIncreases: true,
    },
    {
        id: 'regular',
        name: 'Regular',
        description: 'Standard load',
        users: 1,
        watchSeconds: 5,
        intervalMs: 500,
        durationSeconds: 120,
        scoreIncreases: true,
    },
    {
        id: 'mild_trending',
        name: 'Mild Trending',
        description: 'Moderate engagement',
        users: 5,
        watchSeconds: 5,
        intervalMs: 500,
        durationSeconds: 120,
        scoreIncreases: true,
    },
    {
        id: 'half_hot_trending',
        name: 'Half Hot Trending',
        description: '3s watch — Score does NOT increase (< 5s threshold)',
        users: 10,
        watchSeconds: 3,
        intervalMs: 500,
        durationSeconds: 120,
        scoreIncreases: false,
    },
    {
        id: 'viral_spike',
        name: 'Viral Spike',
        description: 'High burst, 10s watch',
        users: 20,
        watchSeconds: 10,
        intervalMs: 500,
        durationSeconds: 120,
        scoreIncreases: true,
    },
    {
        id: 'noise_traffic',
        name: 'Noise Traffic',
        description: 'Spam-like, 3s watch — Score does NOT increase (< 5s threshold)',
        users: 15,
        watchSeconds: 3,
        intervalMs: 500,
        durationSeconds: 60,
        scoreIncreases: false,
    },
    {
        id: 'long_engagement',
        name: 'Long Engagement',
        description: 'Deep watch, 15s',
        users: 2,
        watchSeconds: 15,
        intervalMs: 500,
        durationSeconds: 180,
        scoreIncreases: true,
    },
];
function getPreset(id) {
    return exports.SCENARIO_PRESETS.find((p) => p.id === id);
}
function listPresets() {
    return [...exports.SCENARIO_PRESETS];
}
//# sourceMappingURL=presets.constants.js.map