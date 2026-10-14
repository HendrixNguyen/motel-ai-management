import { notFound } from "next/navigation";

export type MotelSearchParams = Record<string, string | string[] | undefined>;

/** Pages validate ownership before reading motel-scoped data. An empty list is a real state. */
export function resolveMotelId(motels: readonly { id: string }[], searchParams: MotelSearchParams): string | undefined {
  const selected = searchParams.motel;
  if (selected === undefined) return motels[0]?.id;
  if (typeof selected !== "string" || !motels.some((motel) => motel.id === selected)) notFound();
  return selected;
}
