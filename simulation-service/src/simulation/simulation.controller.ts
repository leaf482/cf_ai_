import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import {
  SimulationScenario,
  SimulationStatus,
} from './interfaces/scenario.interface';
import { ScenarioRegistry } from './engine/scenario-registry';

@Controller('v1/simulation')
export class SimulationController {
  constructor(
    private readonly simulationService: SimulationService,
    private readonly registry: ScenarioRegistry,
  ) {}

  @Post('start')
  start(@Body() scenario: SimulationScenario): SimulationStatus {
    return this.simulationService.start(scenario);
  }

  @Post('start/:scenarioId')
  startByScenario(@Param('scenarioId') scenarioId: string): SimulationStatus {
    return this.simulationService.startByScenarioId(scenarioId);
  }

  @Post('stop')
  stop(): SimulationStatus {
    return this.simulationService.stop();
  }

  @Post('pause')
  pause(): { paused: boolean } {
    this.simulationService.pause();
    return { paused: true };
  }

  @Post('resume')
  resume(): { paused: boolean } {
    this.simulationService.resume();
    return { paused: false };
  }

  @Post('spike')
  spike(): { message: string } {
    this.simulationService.injectSpike(3000, 5);
    return { message: 'Spike injected: 3000 users for 5s' };
  }

  @Get('status')
  status(): SimulationStatus & { run_id?: string } {
    return this.simulationService.getStatus();
  }

  @Get('scenarios')
  scenarios() {
    return this.registry.listTemplates();
  }
}
