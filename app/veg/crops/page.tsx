import { Suspense } from "react";
import { connection } from "next/server";
import { CropWorkspace } from "@/components/veg/crops/crop-workspace";
import { todayISO } from "@/lib/veg/dates";
import { getFrostContext, listBlocks, listCrops } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Crops" };

export default function CropsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CropsContent />
    </Suspense>
  );
}

async function CropsContent() {
  await connection();
  return (
    <CropWorkspace
      crops={await listCrops()}
      blocks={await listBlocks()}
      season={await getSeason()}
      today={todayISO()}
      frostDates={await getFrostContext()}
    />
  );
}
