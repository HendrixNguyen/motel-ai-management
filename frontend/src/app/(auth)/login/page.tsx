"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field from "@/components/ui/field";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { authenticateManager, type LoginFieldErrors } from "@/lib/login-form";

export default function LoginPage() {
  const router = useRouter();
  const [fields, setFields] = useState<LoginFieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [rememberHelpOpen, setRememberHelpOpen] = useState(false);
  const rememberHelpId = useId();
  const rememberHelpRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function dismiss(event: Event) {
      if (event.type === "keydown" && (event as KeyboardEvent).key === "Escape")
        setRememberHelpOpen(false);
      if (event.type === "pointerdown" && !rememberHelpRef.current?.contains(event.target as Node))
        setRememberHelpOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    setFields({});
    const result = await authenticateManager({
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      ...(data.get("rememberMe") === "on" ? { rememberMe: true } : {}),
    });
    if (result.ok) {
      router.replace(result.role === "superadmin" ? "/admin/managers" : "/");
      router.refresh();
    } else {
      setFields(result.fields ?? {});
      setError(result.error);
      if (result.fields?.email) emailRef.current?.focus();
      else if (result.fields?.password) passwordRef.current?.focus();
    }
    setPending(false);
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-[28rem] rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold text-primary">Nhà Số Gọn</p>
        <p className="mb-4 text-sm text-text-muted">Quản lý nhà trọ gọn hơn mỗi ngày</p>
        <h1 className="font-heading text-2xl font-bold text-text">Đăng nhập</h1>
        <p className="mt-2 mb-6 text-text-muted">Quản lý nhà trọ của bạn</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <Field id="email" label="Email" error={fields.email}>
            {(props) => (
              <Input
                {...props}
                ref={emailRef}
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            )}
          </Field>
          <Field id="password" label="Mật khẩu" error={fields.password}>
            {(props) => (
              <Input
                {...props}
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>
          <div className="flex items-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                name="rememberMe"
                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Giữ đăng nhập</span>
            </label>
            <div
              ref={rememberHelpRef}
              className="relative"
              onMouseEnter={() => setRememberHelpOpen(true)}
              onMouseLeave={(event) => {
                if (!rememberHelpRef.current?.contains(event.relatedTarget as Node | null))
                  setRememberHelpOpen(false);
              }}
              onBlur={(event) => {
                if (!rememberHelpRef.current?.contains(event.relatedTarget as Node | null))
                  setRememberHelpOpen(false);
              }}
            >
              <button
                type="button"
                aria-label="Thông tin giữ đăng nhập"
                aria-describedby={rememberHelpOpen ? rememberHelpId : undefined}
                aria-expanded={rememberHelpOpen}
                onFocus={() => setRememberHelpOpen(true)}
                onClick={() => setRememberHelpOpen(true)}
                className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span
                  aria-hidden="true"
                  className="flex size-5 items-center justify-center rounded-full border border-current text-xs font-semibold"
                >
                  i
                </span>
              </button>
              {rememberHelpOpen && (
                <span
                  id={rememberHelpId}
                  role="tooltip"
                  className="absolute left-1/2 top-full z-10 mt-1 w-64 -translate-x-1/2 rounded-input bg-text p-3 text-left text-xs leading-relaxed text-surface shadow-lg"
                >
                  Dành cho thiết bị cá nhân. Tự đăng xuất sau 90 ngày không sử dụng.
                </span>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-input bg-danger-bg p-3 text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
            {pending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </main>
  );
}
