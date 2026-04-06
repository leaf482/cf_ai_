import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SimulationModule } from './simulation/simulation.module';

@Module({
  imports: [PrometheusModule.register(), SimulationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
