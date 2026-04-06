import { Controller, Get } from '@nestjs/common';
import { EventStreamService } from './event-stream.service';

@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventStream: EventStreamService) {}

  @Get('stream')
  getStream() {
    return { events: this.eventStream.getEvents() };
  }
}
