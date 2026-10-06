"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { MotelResponse } from "@/lib/api/types";
import { createMotelFormSession, type MotelFieldErrors } from "@/lib/motel-form";

/** Only the mutation surface hydrates; motel cards and room counts are rendered by the server. */
export default function MotelEditor({ motel, empty = false }: { motel?: MotelResponse; empty?: boolean }) {
  const [currentSession, setCurrentSession] = useState<number>();
  const session = useRef(0);
  const router = useRouter();
  const notify = useToast();
  const open = currentSession !== undefined;

  function show() { session.current += 1; setCurrentSession(session.current); }
  function close() { session.current += 1; setCurrentSession(undefined); }

  return <>
    {empty
      ? <EmptyState title="Chưa có nhà trọ" description="bấm Tạo nhà trọ để bắt đầu" actionLabel="Tạo nhà trọ" onAction={show} />
      : <Button variant={motel ? "secondary" : "primary"} aria-label={motel ? `Chỉnh sửa ${motel.name}` : undefined} onClick={show}>{motel ? "Chỉnh sửa" : "Tạo nhà trọ"}</Button>}
    <Modal open={open} onClose={close} title={motel ? "Chỉnh sửa nhà trọ" : "Tạo nhà trọ"}
      description={motel ? "Cập nhật thông tin, đơn giá, phí và tài khoản nhận tiền." : "Nhập thông tin và đơn giá điện nước của nhà trọ."}>
      {open && <MotelForm motel={motel} onCancel={close} onReload={() => { close(); router.refresh(); }}
        onUnauthorized={() => { close(); router.replace("/login"); router.refresh(); }}
        onSaved={() => {
          // A response to a dismissed form must not close a newer editing session.
          if (session.current === currentSession) close();
          notify({ message: motel ? "Đã lưu thay đổi nhà trọ" : "Đã tạo nhà trọ" });
          router.refresh();
        }} />}
    </Modal>
  </>;
}

function MotelForm({ motel, onCancel, onSaved, onReload, onUnauthorized }: {
  motel?: MotelResponse; onCancel: () => void; onSaved: () => void; onReload: () => void; onUnauthorized: () => void;
}) {
  const [formSession] = useState(() => createMotelFormSession(motel));
  const [draft, setDraft] = useState(formSession.initialDraft);
  const [fields, setFields] = useState<MotelFieldErrors>({});
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<number>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const active = useRef(true);
  const summary = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const feeSequence = useRef(draft.otherFees.length);
  const [feeKeys, setFeeKeys] = useState(() => draft.otherFees.map((_, index) => index));
  const id = (field: string) => `${prefix}-${field}`;

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (error || Object.keys(fields).length) summary.current?.focus();
  }, [error, fields]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFields({});
    setError(undefined);
    setStatus(undefined);
    const result = await formSession.submit(draft);
    pendingRef.current = false;
    if (result.ok) { onSaved(); return; }
    if (!active.current) return;
    if (result.status === 401) { onUnauthorized(); return; }
    setFields(result.fields ?? {});
    setError(result.error);
    setStatus(result.status);
    setPending(false);
  }

  function fieldLabel(key: string) {
    const labels: Record<string, string> = { name: "Tên nhà trọ", address: "Địa chỉ (không bắt buộc)", electricityPrice: "Giá điện (₫/kWh)", waterPrice: "Giá nước (₫/m³)" };
    return labels[key] ?? key;
  }

  return <form onSubmit={save} noValidate className="space-y-6">
    {(error || Object.keys(fields).length > 0) && <div ref={summary} role="alert" tabIndex={-1}
      className="rounded-input border border-danger bg-danger-bg p-3 text-danger focus:outline-2 focus:outline-offset-2 focus:outline-danger">
      {error ? <p>{error}</p> : <>
        <p className="font-semibold">Kiểm tra các trường sau:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          {Object.entries(fields).map(([key, message]) => <li key={key}><a href={`#${id(key)}`} className="underline"
            onClick={(event) => { event.preventDefault(); document.getElementById(id(key))?.focus(); }}>{message}</a></li>)}
        </ul>
      </>}
      {status === 404 && <Button variant="secondary" className="mt-3" onClick={onReload}>Tải lại danh sách</Button>}
    </div>}

    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <legend className="sr-only">Thông tin nhà trọ và đơn giá</legend>
      <Field id={id("name")} label={fieldLabel("name")} error={fields.name}>{(props) => <input {...props} name="name" autoComplete="off" value={draft.name} required
        onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</Field>
      <Field id={id("address")} label={fieldLabel("address")} error={fields.address}>{(props) => <textarea {...props} name="address" rows={2}
        className={`${props.className} py-2`} autoComplete="street-address" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />}</Field>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(["electricityPrice", "waterPrice"] as const).map((key) => <Field key={key} id={id(key)} label={fieldLabel(key)} error={fields[key]} hint="VND, ví dụ 3.500">{(props) => <input {...props}
          name={key} type="text" inputMode="numeric" required value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />}</Field>)}
      </div>
    </fieldset>

    {motel && <>
      <fieldset disabled={pending} className="min-w-0 space-y-4 border-t border-border pt-4">
        <legend className="font-heading font-semibold text-text">Phí khác</legend>
        <p className="text-sm text-text-muted">Các khoản phí áp dụng cho nhà trọ. Xóa dòng để bỏ khoản phí.</p>
        {draft.otherFees.length === 0 && <p className="text-base text-text-body">Chưa có phí khác</p>}
        {draft.otherFees.map((fee, index) => <div key={feeKeys[index]} className="min-w-0 space-y-3 rounded-input border border-border p-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Field id={id(`otherFees.${index}.name`)} label={`Tên phí ${index + 1}`} error={fields[`otherFees.${index}.name`]}>{(props) => <input {...props}
              value={fee.name} required onChange={(event) => setDraft({ ...draft, otherFees: draft.otherFees.map((row, i) => i === index ? { ...row, name: event.target.value } : row) })} />}</Field>
            <Field id={id(`otherFees.${index}.amount`)} label={`Số tiền phí ${index + 1} (₫)`} error={fields[`otherFees.${index}.amount`]}>{(props) => <input {...props}
              type="text" inputMode="numeric" value={fee.amount} required onChange={(event) => setDraft({ ...draft, otherFees: draft.otherFees.map((row, i) => i === index ? { ...row, amount: event.target.value } : row) })} />}</Field>
          </div>
          <Button variant="ghost" aria-label={`Xóa phí ${index + 1}${fee.name ? `: ${fee.name}` : ""}`} onClick={() => {
            setDraft({ ...draft, otherFees: draft.otherFees.filter((_, i) => i !== index) });
            setFeeKeys(feeKeys.filter((_, i) => i !== index));
            setFields({});
          }}>Xóa phí</Button>
        </div>)}
        <Button variant="secondary" onClick={() => {
          setDraft({ ...draft, otherFees: [...draft.otherFees, { name: "", amount: "" }] });
          setFeeKeys([...feeKeys, feeSequence.current++]);
        }}>Thêm phí</Button>
      </fieldset>

      <fieldset disabled={pending} className="min-w-0 space-y-4 border-t border-border pt-4">
        <legend className="font-heading font-semibold text-text">Tài khoản nhận tiền</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-text">
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={draft.bankEnabled}
            onChange={(event) => { setDraft({ ...draft, bankEnabled: event.target.checked }); setFields({}); }} />
          Thiết lập tài khoản nhận tiền
        </label>
        {!draft.bankEnabled && <p className="text-sm text-text-muted">Không dùng tài khoản nhận tiền. Lưu thay đổi sẽ xóa tài khoản đã thiết lập.</p>}
        {draft.bankEnabled && ([
          ["bankCode", "Mã ngân hàng", "Mã BIN ngân hàng, ví dụ 970436"],
          ["accountNumber", "Số tài khoản", undefined],
          ["accountName", "Tên chủ tài khoản", undefined],
        ] as const).map(([key, label, hint]) => <Field key={key} id={id(`bankAccount.${key}`)} label={label} hint={hint} error={fields[`bankAccount.${key}`]}>{(props) => <input {...props}
          type="text" inputMode={key === "accountName" ? "text" : "numeric"} required value={draft.bankAccount[key]}
          onChange={(event) => setDraft({ ...draft, bankAccount: { ...draft.bankAccount, [key]: event.target.value } })} />}</Field>)}
      </fieldset>
    </>}

    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4 pb-[env(safe-area-inset-bottom)]">
      <Button variant="secondary" disabled={pending} onClick={onCancel}>Hủy</Button>
      <Button type="submit" pending={pending} pendingLabel="Đang lưu…">{motel ? "Lưu thay đổi" : "Tạo nhà trọ"}</Button>
    </div>
  </form>;
}
