"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOLDOWN_MS = exports.LOAD_TEST_PHASES = void 0;
exports.phaseToScenario = phaseToScenario;
exports.getPhaseDurationMs = getPhaseDurationMs;
const DEFAULT_VIDEO_IDS = Array.from({ length: 10 }, (_, i) => `video${i + 1}`);
exports.LOAD_TEST_PHASES = [
    { name: 'Phase 1', users: 100, duration_seconds: 120 },
    { name: 'Phase 2', users: 300, duration_seconds: 120 },
    { name: 'Phase 3', users: 500, duration_seconds: 120 },
    { name: 'Phase 4 (limit)', users: 1000, duration_seconds: 600 },
];
const COOLDOWN_MS = 3000;
exports.COOLDOWN_MS = COOLDOWN_MS;
function phaseToScenario(phase) {
    return {
        name: phase.name,
        type: 'normal',
        users: phase.users,
        video_ids: [...DEFAULT_VIDEO_IDS],
        watch_seconds: 30,
        ramp_up_seconds: 10,
        events_per_second: 1,
        duration_seconds: phase.duration_seconds,
    };
}
function getPhaseDurationMs(phase) {
    return phase.duration_seconds * 1000;
}
//# sourceMappingURL=load-test-phases.js.map