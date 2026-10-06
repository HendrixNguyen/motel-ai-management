import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";

/** Task 5 route frame; Task 8 supplies room management. */
export default async function Rooms({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  resolveMotelId(await listMotels(), await searchParams);
  return <h1 className="font-heading text-2xl font-bold text-text">Phòng trọ</h1>;
}
