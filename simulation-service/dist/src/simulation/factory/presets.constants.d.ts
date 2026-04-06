export interface ScenarioPreset {
    id: string;
    name: string;
    description?: string;
    users: number;
    watchSeconds: number;
    intervalMs: number;
    durationSeconds?: number;
    scoreIncreases?: boolean;
}
export declare const SCENARIO_PRESETS: ScenarioPreset[];
export declare function getPreset(id: string): ScenarioPreset | undefined;
export declare function listPresets(): ScenarioPreset[];
