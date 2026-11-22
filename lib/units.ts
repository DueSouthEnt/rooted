export type Units = "metric" | "imperial";

export const UNITS_STORAGE_KEY = "rooted-units";

export function formatLength(cm: number, units: Units): string {
  if (units === "metric") {
    if (cm >= 100) {
      const metres = cm / 100;
      const text = Number.isInteger(metres) ? String(metres) : metres.toFixed(1).replace(/\.0$/, "");
      return `${text} m`;
    }
    return `${Math.round(cm)} cm`;
  }
  const inches = cm / 2.54;
  if (inches >= 24) {
    const feet = Math.floor(inches / 12);
    const remainder = Math.round(inches - feet * 12);
    if (remainder === 12) return `${feet + 1} ft`;
    return remainder ? `${feet} ft ${remainder} in` : `${feet} ft`;
  }
  return `${Math.round(inches)} in`;
}

export function formatTemp(celsius: number, units: Units): string {
  if (units === "metric") return `${Math.round(celsius)}°C`;
  return `${Math.round((celsius * 9) / 5 + 32)}°F`;
}

export function formatTempRange(
  minC: number | null,
  maxC: number | null,
  units: Units,
): string | null {
  if (minC == null || maxC == null) return null;
  if (units === "metric") return `${Math.round(minC)}–${Math.round(maxC)}°C`;
  const min = Math.round((minC * 9) / 5 + 32);
  const max = Math.round((maxC * 9) / 5 + 32);
  return `${min}–${max}°F`;
}

export function cmFromMetres(metres: number): number {
  return Math.round(metres * 100);
}

export function cmFromFeet(feet: number): number {
  return Math.round(feet * 30.48);
}

export function metresFromCm(cm: number): number {
  return Math.round((cm / 100) * 100) / 100;
}

export function feetFromCm(cm: number): number {
  return Math.round((cm / 30.48) * 10) / 10;
}
