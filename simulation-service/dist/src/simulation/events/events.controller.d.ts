import { EventStreamService } from './event-stream.service';
export declare class EventsController {
    private readonly eventStream;
    constructor(eventStream: EventStreamService);
    getStream(): {
        events: import("./event-stream.service").StreamEvent[];
    };
}
