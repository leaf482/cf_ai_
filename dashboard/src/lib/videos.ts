/**
 * Video metadata: ID → display title
 */

export const VIDEO_TITLES: Record<string, string> = {
  video1: 'MrBeast Challenge',
  video2: "POV: You're Late",
  video3: 'Day in my Life (LA)',
  video4: 'Restocking My Fridge',
  video5: 'Is it Cake?',
  video6: 'Golden Retriever Energy',
  video7: 'Street Interview',
  video8: 'GRWM for Prom',
  video9: "Life Hack: Don't",
  video10: "I Won 10,000$",
};

export const VIDEO_IDS = Object.keys(VIDEO_TITLES) as string[];

export function getVideoTitle(videoId: string): string {
  return VIDEO_TITLES[videoId] ?? videoId;
}
