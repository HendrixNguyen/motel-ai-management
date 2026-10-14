import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateManager, validateLogin } from "@/lib/login-form";
import { MANAGER_AUTH } from "@/lib/api/__tests__/fixtures";

describe("login validation", () => {
  it("describes both missing fields inline", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({ email: "Nhập email hợp lệ", password: "Nhập mật khẩu" });
  });
  it("rejects a malformed email without rejecting a filled password", () => {
    expect(validateLogin({ email: "manager", password: "password123" })).toEqual({ email: "Nhập email hợp lệ" });
  });
  it("accepts credentials and leaves password content intact", () => {
    expect(validateLogin({ email: "minhanh@example.vn", password: " password " })).toEqual({});
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("login submission", () => {
  it("rejects missing fields before sending credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await authenticateManager({ email: "", password: "" })).toEqual({ ok: false, fields: { email: "Nhập email hợp lệ", password: "Nhập mật khẩu" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("posts credentials to the same-origin proxy and reports a successful login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(MANAGER_AUTH));
    vi.stubGlobal("fetch", fetchMock);
    expect(await authenticateManager({ email: "minhanh@example.vn", password: " password " })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"email":"minhanh@example.vn","password":" password "}' }));
  });
  it.each([401, 400])("returns a Vietnamese form error for HTTP %s rather than field guesses", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Email hoặc mật khẩu không đúng", code: status === 401 ? "UNAUTHORIZED" : "VALIDATION_ERROR" }, { status })));
    expect(await authenticateManager({ email: "minhanh@example.vn", password: "wrong-password" })).toEqual({ ok: false, error: "Email hoặc mật khẩu không đúng" });
  });
  it("replaces network failures with a safe form message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret backend location")));
    expect(await authenticateManager({ email: "minhanh@example.vn", password: "password123" })).toEqual({ ok: false, error: "Đã xảy ra lỗi hệ thống" });
  });
});
