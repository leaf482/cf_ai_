"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunManager = void 0;
const crypto_1 = require("crypto");
class RunManager {
    state = {
        run_id: '',
        scenario: null,
        started_at: null,
        sent: 0,
        errors: 0,
        running: false,
    };
    startRun(scenario) {
        const run_id = (0, crypto_1.randomUUID)().slice(0, 8);
        this.state = {
            run_id,
            scenario: { ...scenario },
            started_at: new Date(),
            sent: 0,
            errors: 0,
            running: true,
        };
        return { ...this.state };
    }
    stopRun() {
        this.state.running = false;
        return { ...this.state };
    }
    switchPhase(scenario) {
        this.state.scenario = { ...scenario };
        this.state.running = true;
        return { ...this.state };
    }
    recordTick(sent, errors) {
        this.state.sent += sent;
        this.state.errors += errors;
    }
    getState() {
        return { ...this.state };
    }
    getRunId() {
        return this.state.run_id;
    }
}
exports.RunManager = RunManager;
//# sourceMappingURL=run-manager.js.map