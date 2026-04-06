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
exports.FactoryController = void 0;
const common_1 = require("@nestjs/common");
const factory_service_1 = require("./factory.service");
let FactoryController = class FactoryController {
    factoryService;
    constructor(factoryService) {
        this.factoryService = factoryService;
    }
    create(dto) {
        return this.factoryService.createAndStart(dto);
    }
    list() {
        return this.factoryService.listActive();
    }
    getAttribution() {
        return this.factoryService.getAttribution();
    }
    getAttributionDetail() {
        return this.factoryService.getAttributionDetail();
    }
    patch(id, dto) {
        return this.factoryService.patchScenario(id, dto.action);
    }
};
exports.FactoryController = FactoryController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FactoryController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FactoryController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('attribution'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FactoryController.prototype, "getAttribution", null);
__decorate([
    (0, common_1.Get)('attribution/detail'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FactoryController.prototype, "getAttributionDetail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FactoryController.prototype, "patch", null);
exports.FactoryController = FactoryController = __decorate([
    (0, common_1.Controller)('v1/factory/scenarios'),
    __metadata("design:paramtypes", [factory_service_1.FactoryService])
], FactoryController);
//# sourceMappingURL=factory.controller.js.map