import type { LoginInput } from "@/lib/api/types";
import { login } from "@/lib/api/auth.client";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";

export type LoginFieldErrors = { email?: string; password?: string };
type LoginResult = { ok: true } | { ok: false; fields?: LoginFieldErrors; error?: string };

export function validateLogin(input: LoginInput): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = "Nhập email hợp lệ";
  if (!input.password) errors.password = "Nhập mật khẩu";
  return errors;
}

/** Validation owns field errors; an API failure stays a form-level message (D8). */
export async function authenticateManager(input: LoginInput): Promise<LoginResult> {
  const fields = validateLogin(input);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await login(input);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE };
  }
}
