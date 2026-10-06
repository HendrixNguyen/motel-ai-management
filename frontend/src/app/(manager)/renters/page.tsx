import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";

/** Task 5 route frame; Task 9 supplies renter management. */
export default async function Renters({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  resolveMotelId(await listMotels(), await searchParams);
  return <h1 className="font-heading text-2xl font-bold text-text">Khách thuê</h1>;
}
