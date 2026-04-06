"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationStatus = exports.SimulationScenario = void 0;
class SimulationScenario {
    name;
    type;
    users;
    video_ids;
    watch_seconds;
    ramp_up_seconds;
    events_per_second;
    duration_seconds;
}
exports.SimulationScenario = SimulationScenario;
class SimulationStatus {
    running;
    scenario;
    sent;
    errors;
    started_at;
}
exports.SimulationStatus = SimulationStatus;
//# sourceMappingURL=scenario.interface.js.map