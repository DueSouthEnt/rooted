import { addDaysISO, diffDays, formatLong, formatMedium } from "@/lib/veg/dates";

export type FrostTolerance = "tender" | "half_hardy" | "hardy";

export type FrostWarning = {
  severity: "risk" | "caution";
  code: "before_last_frost" | "close_to_last_frost" | "harvest_after_first_frost" | "planted_after_first_frost";
  message: string;
  suggestedFieldDate: string | null;
};

export type FrostAssessment = {
  warnings: FrostWarning[];
  suggestedFieldDate: string | null;
};

const TENDER_BUFFER_DAYS = 7;
const HALF_HARDY_LEAD_DAYS = 14;
const HALF_HARDY_AUTUMN_GRACE_DAYS = 21;

export function monthDay(isoDate: string): string {
  return isoDate.slice(5, 10);
}

export function dateInYear(year: number, monthDayValue: string): string {
  return `${year}-${monthDayValue}`;
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export function assessFrostRisk(input: {
  tolerance: FrostTolerance;
  fieldPlantingDate: string;
  lastHarvestDate: string;
  lastSpringFrost: string;
  firstAutumnFrost: string;
}): FrostAssessment {
  const year = yearOf(input.fieldPlantingDate);
  const lastSpring = dateInYear(year, input.lastSpringFrost);
  const firstAutumn = dateInYear(year, input.firstAutumnFrost);
  const warnings: FrostWarning[] = [];
  const fieldMonth = Number(input.fieldPlantingDate.slice(5, 7));
  const springPlanting = fieldMonth <= 7;

  if (springPlanting && input.fieldPlantingDate < lastSpring) {
    const daysBefore = diffDays(lastSpring, input.fieldPlantingDate);
    if (input.tolerance === "tender") {
      warnings.push({
        severity: "risk",
        code: "before_last_frost",
        message: `Tender crop planted ${daysBefore} days before your average last frost (${formatMedium(lastSpring)}).`,
        suggestedFieldDate: addDaysISO(lastSpring, TENDER_BUFFER_DAYS),
      });
    } else if (input.tolerance === "half_hardy" && daysBefore > HALF_HARDY_LEAD_DAYS) {
      warnings.push({
        severity: "caution",
        code: "before_last_frost",
        message: `Half-hardy crop planted ${daysBefore} days before your average last frost (${formatMedium(lastSpring)}).`,
        suggestedFieldDate: lastSpring,
      });
    }
  } else if (
    springPlanting &&
    input.tolerance === "tender" &&
    input.fieldPlantingDate < addDaysISO(lastSpring, TENDER_BUFFER_DAYS)
  ) {
    const daysAfter = diffDays(input.fieldPlantingDate, lastSpring);
    warnings.push({
      severity: "caution",
      code: "close_to_last_frost",
      message: `Tender crop planted ${daysAfter} days after your average last frost. A clear night can still scorch it.`,
      suggestedFieldDate: addDaysISO(lastSpring, TENDER_BUFFER_DAYS),
    });
  }

  if (!springPlanting && input.fieldPlantingDate > firstAutumn && input.tolerance !== "hardy") {
    warnings.push({
      severity: input.tolerance === "tender" ? "risk" : "caution",
      code: "planted_after_first_frost",
      message: `${input.tolerance === "tender" ? "Tender" : "Half-hardy"} crop planted after your average first frost (${formatMedium(firstAutumn)}).`,
      suggestedFieldDate: null,
    });
  }

  if (input.lastHarvestDate > firstAutumn && input.tolerance !== "hardy") {
    const daysPast = diffDays(input.lastHarvestDate, firstAutumn);
    const grace = input.tolerance === "half_hardy" ? HALF_HARDY_AUTUMN_GRACE_DAYS : 0;
    if (daysPast > grace) {
      const span = diffDays(input.lastHarvestDate, input.fieldPlantingDate);
      const suggested = addDaysISO(firstAutumn, -span);
      warnings.push({
        severity: input.tolerance === "tender" ? "risk" : "caution",
        code: "harvest_after_first_frost",
        message: `Harvest runs to ${formatLong(input.lastHarvestDate)}, ${daysPast} days after your average first frost (${formatMedium(firstAutumn)}).`,
        suggestedFieldDate: suggested < input.fieldPlantingDate ? suggested : null,
      });
    }
  }

  const suggestedFieldDate =
    warnings.find((warning) => warning.severity === "risk" && warning.suggestedFieldDate)?.suggestedFieldDate ??
    warnings.find((warning) => warning.suggestedFieldDate)?.suggestedFieldDate ??
    null;

  return { warnings, suggestedFieldDate };
}

export function frostSummary(assessment: FrostAssessment): string | null {
  return assessment.warnings[0]?.message ?? null;
}

export function plantingFrostWarnings(input: {
  tolerance: FrostTolerance | null;
  fieldPlantingDate: string;
  lastHarvestDate: string;
  lastSpringFrost: string | null;
  firstAutumnFrost: string | null;
}): FrostAssessment {
  if (!input.tolerance || !input.lastSpringFrost || !input.firstAutumnFrost) {
    return { warnings: [], suggestedFieldDate: null };
  }
  return assessFrostRisk({
    tolerance: input.tolerance,
    fieldPlantingDate: input.fieldPlantingDate,
    lastHarvestDate: input.lastHarvestDate,
    lastSpringFrost: input.lastSpringFrost,
    firstAutumnFrost: input.firstAutumnFrost,
  });
}
