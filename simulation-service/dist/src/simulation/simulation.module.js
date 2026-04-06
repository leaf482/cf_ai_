"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const simulation_controller_1 = require("./simulation.controller");
const simulation_service_1 = require("./simulation.service");
const factory_controller_1 = require("./factory/factory.controller");
const presets_controller_1 = require("./factory/presets.controller");
const factory_service_1 = require("./factory/factory.service");
const chaos_controller_1 = require("./chaos/chaos.controller");
const chaos_service_1 = require("./chaos/chaos.service");
const event_log_service_1 = require("./events/event-log.service");
const event_stream_service_1 = require("./events/event-stream.service");
const events_controller_1 = require("./events/events.controller");
const scenario_registry_1 = require("./engine/scenario-registry");
const command_queue_1 = require("./engine/command-queue");
const attribution_index_1 = require("./engine/attribution-index");
const batch_sender_1 = require("./engine/batch-sender");
const master_tick_scheduler_1 = require("./engine/master-tick-scheduler");
const metrics_controller_1 = require("./metrics/metrics.controller");
const metrics_service_1 = require("./metrics/metrics.service");
let SimulationModule = class SimulationModule {
};
exports.SimulationModule = SimulationModule;
exports.SimulationModule = SimulationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.register({
                httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
                httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
            }),
        ],
        controllers: [
            simulation_controller_1.SimulationController,
            factory_controller_1.FactoryController,
            presets_controller_1.PresetsController,
            chaos_controller_1.ChaosController,
            metrics_controller_1.MetricsController,
            events_controller_1.EventsController,
        ],
        providers: [
            simulation_service_1.SimulationService,
            factory_service_1.FactoryService,
            chaos_service_1.ChaosService,
            event_log_service_1.EventLogService,
            event_stream_service_1.EventStreamService,
            scenario_registry_1.ScenarioRegistry,
            command_queue_1.CommandQueue,
            attribution_index_1.AttributionIndex,
            batch_sender_1.BatchSender,
            master_tick_scheduler_1.MasterTickScheduler,
            metrics_service_1.MetricsService,
        ],
    })
], SimulationModule);
//# sourceMappingURL=simulation.module.js.map