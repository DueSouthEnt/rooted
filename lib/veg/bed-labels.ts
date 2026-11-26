/**
 * Which bed numbers to draw along a block edge.
 * Indices are zero-based. `pitchPx` is the on-screen gap between bed centres.
 * `labelPx` is the space one label needs along that edge.
 * Far enough out that the first and last would collide, none are shown.
 */
export function bedNumbersToShow(count: number, pitchPx: number, labelPx: number): number[] {
  if (count <= 0 || !(pitchPx > 0) || !(labelPx > 0)) return [];
  if (count === 1) return pitchPx >= labelPx * 0.45 ? [0] : [];
  const span = pitchPx * (count - 1);
  if (span < labelPx) return [];

  let step = 1;
  while (step < count && pitchPx * step < labelPx) step *= 2;

  const shown: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index % step === 0 || index === count - 1) shown.push(index);
  }
  if (shown.length >= 3) {
    const last = shown[shown.length - 1];
    const previous = shown[shown.length - 2];
    if (previous !== 0 && (last - previous) * pitchPx < labelPx) shown.splice(shown.length - 2, 1);
  }
  if (shown.length >= 2 && (shown[shown.length - 1] - shown[0]) * pitchPx < labelPx) return [];
  return shown;
}

export type ScreenLabel = { id: string; x: number; y: number; w: number; h: number };

/** Keep labels that do not sit on top of one another. Earlier labels win. */
export function labelsThatFit(boxes: ScreenLabel[], gap = 4): string[] {
  const kept: ScreenLabel[] = [];
  const ids: string[] = [];
  for (const box of boxes) {
    if (box.w < 8 || box.h < 8) continue;
    const crowded = kept.some(
      (other) =>
        box.x < other.x + other.w + gap &&
        box.x + box.w + gap > other.x &&
        box.y < other.y + other.h + gap &&
        box.y + box.h + gap > other.y,
    );
    if (!crowded) {
      kept.push(box);
      ids.push(box.id);
    }
  }
  return ids;
}

/** Label size in pixels. Larger when the map is zoomed in, never tiny. */
export function bedLabelPx(zoom: number): number {
  return Math.round(Math.min(15, Math.max(11, 10 + (zoom - 17))));
}
