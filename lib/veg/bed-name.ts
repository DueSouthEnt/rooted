/** The name a gardener sees. Bed 1 is the start edge on the farm map. */
export function gardenerBedName(blockName: string, position: number): string {
  return `${blockName} · Bed ${position + 1}`;
}
