export declare class AttributionIndex {
    private index;
    add(videoId: string, scenarioId: string): void;
    remove(videoId: string, scenarioId: string): void;
    getScenarioIds(videoId: string): string[];
    removeScenario(scenarioId: string, videoId: string): void;
    setScenarioVideo(scenarioId: string, videoId: string): void;
    clearScenario(scenarioId: string, videoId: string): void;
    getAll(): Map<string, string[]>;
}
