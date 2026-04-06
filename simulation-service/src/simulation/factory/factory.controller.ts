import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { FactoryService } from './factory.service';

export interface CreateScenarioDto {
  name?: string;
  presetId?: string;
  users?: number;
  targetVideoId?: string;
  watchSeconds?: number;
  intervalMs?: number;
  durationSeconds?: number;
}

export interface PatchScenarioDto {
  action: 'pause' | 'resume' | 'spike' | 'stop';
}

@Controller('v1/factory/scenarios')
export class FactoryController {
  constructor(private readonly factoryService: FactoryService) {}

  @Post()
  create(@Body() dto: CreateScenarioDto) {
    return this.factoryService.createAndStart(dto);
  }

  @Get()
  list() {
    return this.factoryService.listActive();
  }

  @Get('attribution')
  getAttribution() {
    return this.factoryService.getAttribution();
  }

  @Get('attribution/detail')
  getAttributionDetail() {
    return this.factoryService.getAttributionDetail();
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchScenarioDto) {
    return this.factoryService.patchScenario(id, dto.action);
  }
}
