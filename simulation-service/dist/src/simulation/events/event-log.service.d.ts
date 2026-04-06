export type EventType = 'start' | 'stop' | 'pause' | 'resume' | 'spike' | 'load_spike';
export interface ScenarioEvent {
    type: EventType;
    scenarioId?: string;
    timestamp: number;
}
export declare class EventLogService {
    private events;
    private readonly MAX_EVENTS;
    record(type: EventType, scenarioId?: string): void;
    getEvents(sinceMs?: number): ScenarioEvent[];
}
