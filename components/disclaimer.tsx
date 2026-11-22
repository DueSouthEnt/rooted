import { FROST_DISCLAIMER } from "@/lib/brand";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-xs leading-relaxed text-muted-foreground" : "text-sm leading-relaxed text-muted-foreground"}>
      {FROST_DISCLAIMER}
    </p>
  );
}
