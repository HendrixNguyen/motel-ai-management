"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { createManagerInputSchema, parseCsrfToken } from "@/lib/account-setup";
import { logout } from "@/lib/api/auth.client";
import { ApiError, apiSend } from "@/lib/api/client";

type Account = { id: string; email: string; name: string; role: "manager"; disabledAt: string | null; passwordReady: boolean };

export default function AdminManagersPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [passwordResetTarget, setPasswordResetTarget] = useState<Account | null>(null);
  const [disableTarget, setDisableTarget] = useState<Account | null>(null);
  const [pending, setPending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  async function refresh() {
    const response = await fetch("/api/admin/managers?limit=50&offset=0", { credentials: "same-origin" });
    if (!response.ok) throw new Error("unauthorized");
    setCsrfToken(parseCsrfToken(response.headers.get("x-csrf-token")));
    setAccounts(await response.json() as Account[]);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Đăng xuất thất bại");
      setLoggingOut(false);
    }
  }


  async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
    try {
      const token = csrfToken;
      const headers: Record<string, string> = token ? { "x-csrf-token": token } : {};
      const payload = body === undefined ? undefined : { ...(body as Record<string, unknown>) };
      return method === "PATCH"
        ? await apiSend<T>(url, "PATCH", payload, headers)
        : await apiSend<T>(url, "POST", payload, headers);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) await refresh();
      throw new Error(error instanceof ApiError && error.status === 403 ? "Phiên đăng nhập hết hạn hoặc yêu cầu không hợp lệ" : "Thao tác thất bại");
    }
  }
  useEffect(() => { queueMicrotask(() => { refresh().catch(() => setError("Không tải được danh sách tài khoản")); }); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await send<Account>("/api/admin/managers", "POST", createManagerInputSchema({ email: String(data.get("email") ?? ""), name: String(data.get("name") ?? ""), password: String(data.get("password") ?? ""), phone: String(data.get("phone") ?? "") }));
      form.reset(); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tạo được tài khoản"); }
  }
  async function action(account: Account, enabled?: boolean) {
    setError("");
    if (enabled === false) { setDisableTarget(account); return; }
    if (enabled === true && !window.confirm(`Mở khóa tài khoản ${account.email}?`)) return;
    try {
      if (enabled !== undefined) await send(`/api/admin/managers/${account.id}`, "PATCH", { enabled });
      else setPasswordResetTarget(account);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Thao tác thất bại"); }
  }
  async function confirmDisable() {
    if (!disableTarget) return;
    setPending(true);
    try {
      await send(`/api/admin/managers/${disableTarget.id}`, "PATCH", { enabled: false });
      setDisableTarget(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không khóa được tài khoản"); }
    finally { setPending(false); }
  }
  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordResetTarget) return;
    setError("");
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 8 || password.length > 256) { setError("Mật khẩu phải có từ 8 đến 256 ký tự"); return; }
    setPending(true);
    try {
      await send(`/api/admin/managers/${passwordResetTarget.id}/reset-password`, "POST", { password });
      setPasswordResetTarget(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không đổi được mật khẩu"); }
    finally { setPending(false); }
  }
  return <main id="main-content" className="mx-auto max-w-4xl space-y-8 p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text">Quản lý tài khoản</h1>
        <p className="mt-2 text-text-muted">Chỉ quản lý quyền truy cập của người quản lý.</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={handleLogout}
        pending={loggingOut}
        pendingLabel="Đang đăng xuất…"
      >
        Đăng xuất
      </Button>
    </header>
    <form onSubmit={create} className="grid gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">Tạo tài khoản quản lý</h2>
      <Field id="manager-name" label="Họ tên">{(props) => <input {...props} name="name" required maxLength={160} />}</Field>
      <Field id="manager-email" label="Email">{(props) => <input {...props} name="email" type="email" required />}</Field>
      <Field id="manager-password" label="Mật khẩu" hint="Tối thiểu 8 ký tự">{(props) => <input {...props} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required />}</Field>
      <Field id="manager-phone" label="Điện thoại">{(props) => <input {...props} name="phone" maxLength={40} />}</Field>
      <button className="min-h-11 rounded-input bg-primary px-4 font-semibold text-white sm:self-end">Tạo tài khoản</button>
    </form>
    <Modal open={Boolean(passwordResetTarget)} onClose={() => { if (!pending) setPasswordResetTarget(null); }} title="Đổi mật khẩu" description={passwordResetTarget ? `Đặt mật khẩu mới cho ${passwordResetTarget.email}. Phiên hiện tại của người này sẽ bị đăng xuất.` : undefined}>
      {passwordResetTarget && <form key={passwordResetTarget.id} onSubmit={submitPasswordReset} className="space-y-3">
        <Field id="manager-reset-password" label="Mật khẩu mới" hint="Tối thiểu 8 ký tự">{(props) => <input {...props} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required />}</Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => setPasswordResetTarget(null)}>Hủy</Button><Button type="submit" pending={pending}>Lưu mật khẩu</Button></div>
      </form>}
    </Modal>
    <ConfirmDialog open={Boolean(disableTarget)} onClose={() => setDisableTarget(null)} title="Khóa tài khoản quản lý?" description={disableTarget ? `Khóa ${disableTarget.email}; dữ liệu và quyền truy cập của người thuê không thay đổi.` : undefined} onConfirm={confirmDisable} confirmLabel="Khóa tài khoản" destructive pending={pending} />
    {error && <p role="alert" className="rounded-input bg-danger-bg p-3 text-danger">{error}</p>}
    <section className="overflow-x-auto rounded-card border border-border bg-surface"><h2 className="p-5 font-semibold">Danh sách quản lý</h2><table className="w-full text-left text-sm"><thead><tr className="border-y border-border"><th className="p-3">Tài khoản</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} className="border-b border-border"><td className="p-3">{account.name}<br /><span className="text-text-muted">{account.email}</span></td><td className="p-3">{account.disabledAt ? "Đã khóa" : account.passwordReady ? "Đang hoạt động" : "Chờ cài mật khẩu"}</td><td className="flex flex-wrap gap-2 p-3"><button className="min-h-10 rounded-input border border-border px-3" onClick={() => action(account)}>Đổi mật khẩu</button>{account.disabledAt ? <button className="min-h-10 rounded-input border border-border px-3" onClick={() => action(account, true)}>Mở khóa</button> : <button className="min-h-10 rounded-input border border-danger px-3 text-danger" aria-label={`Khóa ${account.email}`} onClick={() => action(account, false)}>Khóa</button>}</td></tr>)}</tbody></table></section>
  </main>;
}
