export interface WeightedChoice<T> {
    value: T;
    weight: number;
}
export declare function sampleWeighted<T>(rng: () => number, items: WeightedChoice<T>[]): T;
export declare function samplePoisson(rng: () => number, lambda: number): number;
export interface ZipfSelector<T> {
    pick: () => T;
    weights: Array<{
        value: T;
        weight: number;
    }>;
}
export declare function buildZipfSelector<T>(rng: () => number, valuesInPopularityOrder: T[], skew?: number): ZipfSelector<T>;
export interface WatchDurationSampler {
    sample: () => number;
    distribution: Array<{
        seconds: number;
        weight: number;
    }>;
}
export declare function buildWatchDurationSampler(rng: () => number, distribution?: Array<{
    seconds: number;
    weight: number;
}>): WatchDurationSampler;
