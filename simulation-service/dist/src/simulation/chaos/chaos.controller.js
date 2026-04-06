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
exports.ChaosController = void 0;
const common_1 = require("@nestjs/common");
const chaos_service_1 = require("./chaos.service");
let ChaosController = class ChaosController {
    chaosService;
    constructor(chaosService) {
        this.chaosService = chaosService;
    }
    pauseWorker(id) {
        return this.chaosService.pauseWorker(id);
    }
    getPausedWorkers() {
        return { paused: this.chaosService.getPausedWorkers() };
    }
    loadSpike() {
        return this.chaosService.triggerLoadSpike();
    }
};
exports.ChaosController = ChaosController;
__decorate([
    (0, common_1.Post)('worker/:id/pause'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChaosController.prototype, "pauseWorker", null);
__decorate([
    (0, common_1.Get)('workers/paused'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChaosController.prototype, "getPausedWorkers", null);
__decorate([
    (0, common_1.Post)('load-spike'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChaosController.prototype, "loadSpike", null);
exports.ChaosController = ChaosController = __decorate([
    (0, common_1.Controller)('v1/chaos'),
    __metadata("design:paramtypes", [chaos_service_1.ChaosService])
], ChaosController);
//# sourceMappingURL=chaos.controller.js.map