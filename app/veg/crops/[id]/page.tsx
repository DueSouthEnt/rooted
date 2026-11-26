import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader } from "@/components/veg/page-header";
import { METHOD_LABEL } from "@/lib/veg/labels";
import { CropCompanions } from "@/components/veg/crops/crop-companions";
import { getCrop, listCompanions } from "@/lib/veg/queries";
import { formatNumber } from "@/lib/veg/units";
import Loading from "../../loading";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return { title: id };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function months(start: number | null, end: number | null): string {
  if (!start || !end) return "Not used";
  return `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
}

export default function CropDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <CropDetail params={props.params} />
    </Suspense>
  );
}

async function CropDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const crop = await getCrop(id);
  if (!crop) notFound();
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={crop.family ?? crop.category}
        title={`${crop.name} · ${crop.cultivar}`}
        description={crop.notes}
        actions={
          <Link href="/veg/crops" className="text-sm text-primary underline-offset-2 hover:underline">
            Back to the library
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Hardiness" value={crop.frostTolerance === "half_hardy" ? "Half-hardy" : crop.frostTolerance === "tender" ? "Tender" : crop.frostTolerance === "hardy" ? "Hardy" : "Not recorded"} />
        <Fact label="Method" value={METHOD_LABEL[crop.plantingMethod]} />
        <Fact label="Days to maturity" value={`${crop.daysToMaturity}${crop.dtmIsTypical ? " (typical for the crop)" : ""}`} />
        <Fact label="Nursery" value={crop.daysInNursery ? `${crop.daysInNursery} days` : "Direct sown"} />
        <Fact label="Harvest window" value={`${crop.harvestWindowDays} days`} />
        <Fact label="In-row spacing" value={`${formatNumber(crop.inRowSpacingIn, 1)} in`} />
        <Fact label="Between rows" value={crop.betweenRowCm ? `${crop.betweenRowCm} cm` : "Not recorded"} />
        <Fact label="Rows per bed" value={String(crop.rowsPerBed)} />
        <Fact label="Min soil temperature" value={crop.minSoilTempC ? `${crop.minSoilTempC}°C` : "Not recorded"} />
        <Fact
          label="Germination"
          value={
            crop.germinationTempMin
              ? `${crop.germinationTempMin}–${crop.germinationTempMax}°C, ${crop.germinationDaysMin}–${crop.germinationDaysMax} days`
              : "Not recorded"
          }
        />
        <Fact label="Sow indoors" value={months(crop.sowIndoorsStart, crop.sowIndoorsEnd)} />
        <Fact label="Sow outdoors" value={months(crop.sowOutdoorsStart, crop.sowOutdoorsEnd)} />
        <Fact label="Transplant" value={months(crop.transplantStart, crop.transplantEnd)} />
        <Fact
          label="Yield / 100 bed-ft"
          value={`${formatNumber(crop.yieldPer100BedFeet, 0)} ${crop.yieldUnit}${crop.yieldIsEstimate ? " (planning estimate)" : ""}`}
        />
      </div>
      <CropCompanions cropId={crop.id} cropName={crop.name} family={crop.rotationFamily} rules={await listCompanions()} />
      {crop.hardinessNotes ? <p className="max-w-3xl text-sm leading-6">{crop.hardinessNotes}</p> : null}
      {crop.sourceUrl ? (
        <p className="text-sm">
          Source: {crop.sourceName ?? crop.supplier}{" "}
          <a className="text-primary underline" href={crop.sourceUrl}>
            {crop.sourceUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
