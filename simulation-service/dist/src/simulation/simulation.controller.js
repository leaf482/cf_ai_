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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationController = void 0;
const common_1 = require("@nestjs/common");
const simulation_service_1 = require("./simulation.service");
const scenario_interface_1 = require("./interfaces/scenario.interface");
const scenario_registry_1 = require("./engine/scenario-registry");
let SimulationController = class SimulationController {
    simulationService;
    registry;
    constructor(simulationService, registry) {
        this.simulationService = simulationService;
        this.registry = registry;
    }
    start(scenario) {
        return this.simulationService.start(scenario);
    }
    startByScenario(scenarioId) {
        return this.simulationService.startByScenarioId(scenarioId);
    }
    stop() {
        return this.simulationService.stop();
    }
    pause() {
        this.simulationService.pause();
        return { paused: true };
    }
    resume() {
        this.simulationService.resume();
        return { paused: false };
    }
    spike() {
        this.simulationService.injectSpike(3000, 5);
        return { message: 'Spike injected: 3000 users for 5s' };
    }
    status() {
        return this.simulationService.getStatus();
    }
    scenarios() {
        return this.registry.listTemplates();
    }
};
exports.SimulationController = SimulationController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [scenario_interface_1.SimulationScenario]),
    __metadata("design:returntype", scenario_interface_1.SimulationStatus)
], SimulationController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('start/:scenarioId'),
    __param(0, (0, common_1.Param)('scenarioId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", scenario_interface_1.SimulationStatus)
], SimulationController.prototype, "startByScenario", null);
__decorate([
    (0, common_1.Post)('stop'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", scenario_interface_1.SimulationStatus)
], SimulationController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)('pause'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SimulationController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)('resume'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SimulationController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)('spike'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SimulationController.prototype, "spike", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SimulationController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('scenarios'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SimulationController.prototype, "scenarios", null);
exports.SimulationController = SimulationController = __decorate([
    (0, common_1.Controller)('v1/simulation'),
    __metadata("design:paramtypes", [simulation_service_1.SimulationService,
        scenario_registry_1.ScenarioRegistry])
], SimulationController);
//# sourceMappingURL=simulation.controller.js.map