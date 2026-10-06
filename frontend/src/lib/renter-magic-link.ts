import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createRenterMagicLink } from "@/lib/api/renters.client";

type MagicLinkResult = { ok: true; url: string } | { ok: false; status: number; error: string };

/** A single in-flight mutation per mounted renter action, with safe retryable errors. */
export function createMagicLinkSession(motelId: string, renterId: string) {
  let pending: Promise<MagicLinkResult> | undefined;
  async function create(): Promise<MagicLinkResult> {
    try {
      const { url } = await createRenterMagicLink(motelId, renterId);
      return { ok: true, url };
    } catch (error) {
      return { ok: false, status: error instanceof ApiError ? error.status : 0,
        error: error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE };
    }
  }
  return { submit(): Promise<MagicLinkResult> {
    pending ??= create().finally(() => { pending = undefined; });
    return pending;
  } };
}
