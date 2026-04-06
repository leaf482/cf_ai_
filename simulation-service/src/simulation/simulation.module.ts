import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import * as http from 'http';
import * as https from 'https';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { FactoryController } from './factory/factory.controller';
import { PresetsController } from './factory/presets.controller';
import { FactoryService } from './factory/factory.service';
import { ChaosController } from './chaos/chaos.controller';
import { ChaosService } from './chaos/chaos.service';
import { EventLogService } from './events/event-log.service';
import { EventStreamService } from './events/event-stream.service';
import { EventsController } from './events/events.controller';
import { ScenarioRegistry } from './engine/scenario-registry';
import { CommandQueue } from './engine/command-queue';
import { AttributionIndex } from './engine/attribution-index';
import { BatchSender } from './engine/batch-sender';
import { MasterTickScheduler } from './engine/master-tick-scheduler';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';

@Module({
  imports: [
    HttpModule.register({
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
    }),
  ],
  controllers: [
    SimulationController,
    FactoryController,
    PresetsController,
    ChaosController,
    MetricsController,
    EventsController,
  ],
  providers: [
    SimulationService,
    FactoryService,
    ChaosService,
    EventLogService,
    EventStreamService,
    ScenarioRegistry,
    CommandQueue,
    AttributionIndex,
    BatchSender,
    MasterTickScheduler,
    MetricsService,
  ],
})
export class SimulationModule {}
