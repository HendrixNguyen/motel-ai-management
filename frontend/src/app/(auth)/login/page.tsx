"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field from "@/components/ui/field";
import Button from "@/components/ui/button";
import { authenticateManager, type LoginFieldErrors } from "@/lib/login-form";

export default function LoginPage() {
  const router = useRouter();
  const [fields, setFields] = useState<LoginFieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    setFields({});
    const result = await authenticateManager({ email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? "") });
    if (result.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setFields(result.fields ?? {});
      setError(result.error);
      if (result.fields?.email) emailRef.current?.focus();
      else if (result.fields?.password) passwordRef.current?.focus();
    }
    setPending(false);
  }

  const controlClass = "min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-[28rem] rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold text-primary">Nhà Số Gọn</p><p className="mb-4 text-sm text-text-muted">Quản lý nhà trọ gọn hơn mỗi ngày</p><h1 className="font-heading text-2xl font-bold text-text">Đăng nhập</h1>
        <p className="mt-2 mb-6 text-text-muted">Quản lý nhà trọ của bạn</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <Field id="email" label="Email" error={fields.email}>{(props) => <input {...props} ref={emailRef} name="email" type="email" autoComplete="username" required className={controlClass} />}</Field>
          <Field id="password" label="Mật khẩu" error={fields.password}>{(props) => <input {...props} ref={passwordRef} name="password" type="password" autoComplete="current-password" required className={controlClass} />}</Field>
          {error && <p role="alert" className="rounded-input bg-danger-bg p-3 text-danger">{error}</p>}
          <Button type="submit" pending={pending} pendingLabel="Đang đăng nhập…" className="w-full">Đăng nhập</Button>
        </form>
      </div>
    </main>
  );
}
