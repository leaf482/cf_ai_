import { Controller, Get, Param, Post } from '@nestjs/common';
import { ChaosService } from './chaos.service';

@Controller('v1/chaos')
export class ChaosController {
  constructor(private readonly chaosService: ChaosService) {}

  @Post('worker/:id/pause')
  pauseWorker(@Param('id') id: string) {
    return this.chaosService.pauseWorker(id);
  }

  @Get('workers/paused')
  getPausedWorkers() {
    return { paused: this.chaosService.getPausedWorkers() };
  }

  @Post('load-spike')
  loadSpike() {
    return this.chaosService.triggerLoadSpike();
  }
}
