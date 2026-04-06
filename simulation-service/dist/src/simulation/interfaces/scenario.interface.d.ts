export type SimulationType = 'normal' | 'spike' | 'gradual';
export declare class SimulationScenario {
    name: string;
    type: SimulationType;
    users: number;
    video_ids: string[];
    watch_seconds: number;
    ramp_up_seconds: number;
    events_per_second: number;
    duration_seconds?: number;
}
export declare class SimulationStatus {
    running: boolean;
    scenario: SimulationScenario | null;
    sent: number;
    errors: number;
    started_at: Date | null;
}
