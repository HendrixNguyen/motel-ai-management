import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, GENERIC_ERROR_MESSAGE, assertRelativePath, decodeResponse } from "./client";

export async function serverGetRenter<T>(path: string): Promise<T> {
  assertRelativePath(path);
  const cookie = (await cookies()).toString();
  let response: Response;
  try { response = await fetch(`${process.env.BACKEND_URL ?? "http://localhost:3000"}${path}`, { method: "GET", cache: "no-store", headers: { accept: "application/json", ...(cookie ? { cookie } : {}) } }); } catch { throw new ApiError(0, "INTERNAL_ERROR", GENERIC_ERROR_MESSAGE); }
  if (response.status === 401) redirect("/renter");
  return decodeResponse<T>(response);
}
