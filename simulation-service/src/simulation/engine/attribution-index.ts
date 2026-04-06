/**
 * Attribution reverse index: videoId -> scenarioId[]
 * Tracks which scenarios target which videos.
 */

export class AttributionIndex {
  private index = new Map<string, Set<string>>();

  add(videoId: string, scenarioId: string): void {
    let set = this.index.get(videoId);
    if (!set) {
      set = new Set();
      this.index.set(videoId, set);
    }
    set.add(scenarioId);
  }

  remove(videoId: string, scenarioId: string): void {
    const set = this.index.get(videoId);
    if (set) {
      set.delete(scenarioId);
      if (set.size === 0) this.index.delete(videoId);
    }
  }

  getScenarioIds(videoId: string): string[] {
    return Array.from(this.index.get(videoId) ?? []);
  }

  removeScenario(scenarioId: string, videoId: string): void {
    this.remove(videoId, scenarioId);
  }

  /** Update when scenario targets a video */
  setScenarioVideo(scenarioId: string, videoId: string): void {
    this.add(videoId, scenarioId);
  }

  /** Clear all references to a scenario (e.g. when stopped) */
  clearScenario(scenarioId: string, videoId: string): void {
    this.remove(videoId, scenarioId);
  }

  getAll(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [videoId, set] of this.index) {
      out.set(videoId, Array.from(set));
    }
    return out;
  }
}
