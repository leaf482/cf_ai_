export interface WeightedChoice<T> {
  value: T;
  weight: number;
}

export function sampleWeighted<T>(
  rng: () => number,
  items: WeightedChoice<T>[],
): T {
  const total = items.reduce((a, it) => a + Math.max(0, it.weight), 0);
  if (total <= 0) return items[0]?.value;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it.value;
  }
  return items[items.length - 1]?.value;
}

// Poisson(lambda) sampler.
// - Knuth for small lambda (accurate)
// - Normal approximation for large lambda (fast, good enough for simulation)
export function samplePoisson(rng: () => number, lambda: number): number {
  const l = Math.max(0, lambda);
  if (l === 0) return 0;

  if (l < 50) {
    // Knuth
    const L = Math.exp(-l);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng();
    } while (p > L);
    return k - 1;
  }

  // Normal approximation N(lambda, lambda)
  // Box-Muller transform
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const n = Math.round(l + Math.sqrt(l) * z);
  return Math.max(0, n);
}

export interface ZipfSelector<T> {
  pick: () => T;
  weights: Array<{ value: T; weight: number }>;
}

/**
 * Zipf-like selector: weight_i ∝ 1 / (rank^skew).
 * rank is 1..N in the order provided (first item most popular).
 */
export function buildZipfSelector<T>(
  rng: () => number,
  valuesInPopularityOrder: T[],
  skew = 1.1,
): ZipfSelector<T> {
  const items = valuesInPopularityOrder.map((v, idx) => ({
    value: v,
    weight: 1 / Math.pow(idx + 1, Math.max(0.01, skew)),
  }));
  return {
    pick: () => sampleWeighted(rng, items),
    weights: items,
  };
}

export interface WatchDurationSampler {
  sample: () => number; // ms
  distribution: Array<{ seconds: number; weight: number }>;
}

export function buildWatchDurationSampler(
  rng: () => number,
  distribution: Array<{ seconds: number; weight: number }> = [
    { seconds: 3, weight: 50 },
    { seconds: 10, weight: 30 },
    { seconds: 30, weight: 15 },
    { seconds: 60, weight: 5 },
  ],
): WatchDurationSampler {
  const items = distribution.map((d) => ({
    value: d.seconds * 1000,
    weight: d.weight,
  }));
  return {
    sample: () => sampleWeighted(rng, items),
    distribution,
  };
}
