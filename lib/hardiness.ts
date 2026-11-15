/** RHS hardiness ratings, coldest first in the rank list. */
export const RHS_RATINGS = [
  "H1a",
  "H1b",
  "H1c",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "H7",
] as const;

export type RhsRating = (typeof RHS_RATINGS)[number];

export const RHS_BLURB: Record<RhsRating, string> = {
  H1a: "Heated glass, warmer than 15°C",
  H1b: "Heated glass, 10 to 15°C",
  H1c: "Heated glass, 5 to 10°C",
  H2: "Tender — frost-free glass, 1 to 5°C",
  H3: "Half-hardy — down to about −5°C",
  H4: "Hardy in a mild winter, down to about −10°C",
  H5: "Hardy through an average UK winter, down to about −15°C",
  H6: "Hardy through a severe UK winter, down to about −20°C",
  H7: "Very hardy, colder than −20°C",
};

export function isRhsRating(value: string): value is RhsRating {
  return (RHS_RATINGS as readonly string[]).includes(value);
}

/** Higher rank means the plant, or the winter, is hardier / colder. */
export function rhsRank(rating: RhsRating): number {
  return RHS_RATINGS.indexOf(rating);
}

/**
 * Map an average winter minimum (°C) onto the RHS band for the site.
 * Bands follow the temperature ranges published by the RHS.
 */
export function rhsFromMinC(tempC: number): RhsRating {
  if (tempC > 15) return "H1a";
  if (tempC > 10) return "H1b";
  if (tempC > 5) return "H1c";
  if (tempC > 1) return "H2";
  if (tempC > -5) return "H3";
  if (tempC > -10) return "H4";
  if (tempC > -15) return "H5";
  if (tempC > -20) return "H6";
  return "H7";
}

const USDA_BANDS: { zone: string; minF: number; maxF: number }[] = [
  { zone: "1a", minF: -60, maxF: -55 },
  { zone: "1b", minF: -55, maxF: -50 },
  { zone: "2a", minF: -50, maxF: -45 },
  { zone: "2b", minF: -45, maxF: -40 },
  { zone: "3a", minF: -40, maxF: -35 },
  { zone: "3b", minF: -35, maxF: -30 },
  { zone: "4a", minF: -30, maxF: -25 },
  { zone: "4b", minF: -25, maxF: -20 },
  { zone: "5a", minF: -20, maxF: -15 },
  { zone: "5b", minF: -15, maxF: -10 },
  { zone: "6a", minF: -10, maxF: -5 },
  { zone: "6b", minF: -5, maxF: 0 },
  { zone: "7a", minF: 0, maxF: 5 },
  { zone: "7b", minF: 5, maxF: 10 },
  { zone: "8a", minF: 10, maxF: 15 },
  { zone: "8b", minF: 15, maxF: 20 },
  { zone: "9a", minF: 20, maxF: 25 },
  { zone: "9b", minF: 25, maxF: 30 },
  { zone: "10a", minF: 30, maxF: 35 },
  { zone: "10b", minF: 35, maxF: 40 },
  { zone: "11a", minF: 40, maxF: 45 },
  { zone: "11b", minF: 45, maxF: 50 },
  { zone: "12a", minF: 50, maxF: 55 },
  { zone: "12b", minF: 55, maxF: 60 },
  { zone: "13a", minF: 60, maxF: 65 },
  { zone: "13b", minF: 65, maxF: 70 },
];

export function cToF(tempC: number): number {
  return (tempC * 9) / 5 + 32;
}

export function fToC(tempF: number): number {
  return ((tempF - 32) * 5) / 9;
}

/** USDA zone from an average annual extreme minimum, in °C. */
export function usdaFromMinC(tempC: number): string {
  const tempF = cToF(tempC);
  if (tempF < -60) return "1a";
  if (tempF >= 70) return "13b";
  const band = USDA_BANDS.find((item) => tempF >= item.minF && tempF < item.maxF);
  return band?.zone ?? "13b";
}

/** 6a -> 6, 6b -> 6.5. Returns null if the string isn't a zone. */
export function usdaNumber(zone: string): number | null {
  const match = zone.trim().toLowerCase().match(/^(\d{1,2})([ab])?$/);
  if (!match) return null;
  const base = Number(match[1]);
  if (base < 1 || base > 13) return null;
  return base + (match[2] === "b" ? 0.5 : 0);
}

export function formatUsda(zone: string): string {
  return zone.toUpperCase().replace(/([AB])$/, (letter) => letter.toLowerCase());
}
