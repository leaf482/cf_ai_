import { Controller, Get } from '@nestjs/common';
import { listPresets } from './presets.constants';

@Controller('v1/factory')
export class PresetsController {
  @Get('presets')
  getPresets() {
    return listPresets();
  }
}
