"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleWeighted = sampleWeighted;
exports.samplePoisson = samplePoisson;
exports.buildZipfSelector = buildZipfSelector;
exports.buildWatchDurationSampler = buildWatchDurationSampler;
function sampleWeighted(rng, items) {
    const total = items.reduce((a, it) => a + Math.max(0, it.weight), 0);
    if (total <= 0)
        return items[0]?.value;
    let r = rng() * total;
    for (const it of items) {
        r -= Math.max(0, it.weight);
        if (r <= 0)
            return it.value;
    }
    return items[items.length - 1]?.value;
}
function samplePoisson(rng, lambda) {
    const l = Math.max(0, lambda);
    if (l === 0)
        return 0;
    if (l < 50) {
        const L = Math.exp(-l);
        let k = 0;
        let p = 1;
        do {
            k++;
            p *= rng();
        } while (p > L);
        return k - 1;
    }
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const n = Math.round(l + Math.sqrt(l) * z);
    return Math.max(0, n);
}
function buildZipfSelector(rng, valuesInPopularityOrder, skew = 1.1) {
    const items = valuesInPopularityOrder.map((v, idx) => ({
        value: v,
        weight: 1 / Math.pow(idx + 1, Math.max(0.01, skew)),
    }));
    return {
        pick: () => sampleWeighted(rng, items),
        weights: items,
    };
}
function buildWatchDurationSampler(rng, distribution = [
    { seconds: 3, weight: 50 },
    { seconds: 10, weight: 30 },
    { seconds: 30, weight: 15 },
    { seconds: 60, weight: 5 },
]) {
    const items = distribution.map((d) => ({
        value: d.seconds * 1000,
        weight: d.weight,
    }));
    return {
        sample: () => sampleWeighted(rng, items),
        distribution,
    };
}
//# sourceMappingURL=sampling.js.map