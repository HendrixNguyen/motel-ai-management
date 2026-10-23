"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { RenterResponse, RoomResponse } from "@/lib/api/types";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { uploadRenterCccd } from "@/lib/api/renters.client";
import { createRenterFormSession, type RenterFieldErrors } from "@/lib/renter-form";
import FileUpload from "@/components/ui/file-upload";

export default function RenterEditor({
  motelId,
  rooms,
  renter,
  initiallyOpen = false,
}: {
  motelId: string;
  rooms: RoomResponse[];
  renter?: RenterResponse;
  initiallyOpen?: boolean;
}) {
  const [currentSession, setCurrentSession] = useState<number | undefined>(
    initiallyOpen ? 1 : undefined,
  );
  const session = useRef(initiallyOpen ? 1 : 0);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const notify = useToast();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    session.current += 1;
    setCurrentSession(undefined);
  };
  const closeFromDialog = () => {
    close();
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inline-flex min-h-11 items-center rounded-input border border-border-strong bg-surface px-4 py-2.5 font-semibold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={renter ? `Chỉnh sửa ${renter.name}` : undefined}
        onClick={() => {
          session.current += 1;
          setFormKey((current) => current + 1);
          setCurrentSession(session.current);
        }}
      >
        {renter ? "Chỉnh sửa" : "Thêm khách thuê"}
      </button>
      <Modal
        open={currentSession !== undefined}
        onClose={closeFromDialog}
        title={renter ? "Chỉnh sửa khách thuê" : "Thêm khách thuê"}
        description="Nhập thông tin liên hệ và chọn phòng nếu đã xếp phòng."
      >
        {currentSession !== undefined && (
          <RenterForm
            key={formKey}
            motelId={motelId}
            rooms={rooms}
            renter={renter}
            onCancel={closeFromDialog}
            onReload={() => {
              close();
              router.refresh();
            }}
            onUnauthorized={() => {
              close();
              router.replace("/login");
              router.refresh();
            }}
            onSaved={() => {
              // A dismissed request may refresh rows; it cannot close a newer form.
              if (session.current === currentSession) close();
              notify({ message: renter ? "Đã lưu thay đổi khách thuê" : "Đã thêm khách thuê" });
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function RenterForm({
  motelId,
  rooms,
  renter,
  onCancel,
  onSaved,
  onReload,
  onUnauthorized,
}: {
  motelId: string;
  rooms: RoomResponse[];
  renter?: RenterResponse;
  onCancel: () => void;
  onSaved: () => void;
  onReload: () => void;
  onUnauthorized: () => void;
}) {
  const [formSession] = useState(() => createRenterFormSession(motelId, renter));
  const [draft, setDraft] = useState(formSession.initialDraft);
  const [fields, setFields] = useState<RenterFieldErrors>({});
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<number>();
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const [cccdStatus, setCccdStatus] = useState({
    front: renter?.idCardFrontUploaded ?? false,
    back: renter?.idCardBackUploaded ?? false,
  });
  const [cccdError, setCccdError] = useState("");
  const [cccdPending, setCccdPending] = useState(false);
  const pendingRef = useRef(false);
  const active = useRef(true);
  const summary = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const id = (field: string) => `${prefix}-${field}`;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, [formSession]);
  useEffect(() => {
    if (error || Object.keys(fields).length) summary.current?.focus();
  }, [error, fields]);

  async function uploadCccd(side: "front" | "back", file: File) {
    if (!renter) return;
    setCccdPending(true);
    setCccdError("");
    try {
      await uploadRenterCccd(motelId, renter.id, side, file);
      setCccdStatus((current) => ({ ...current, [side]: true }));
      router.refresh();
    } catch (cause) {
      setCccdError(
        cause instanceof ApiError && cause.status >= 400 && cause.status < 500
          ? cause.message
          : "Không thể tải ảnh CCCD. Vui lòng thử lại.",
      );
    } finally {
      setCccdPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFields({});
    setError(undefined);
    setStatus(undefined);
    const submittedDraft = structuredClone(draft);
    try {
      const result = await formSession.submit(submittedDraft);
      if (result.ok) {
        onSaved();
        return;
      }
      if (!active.current) return;
      if (result.status === 401) {
        onUnauthorized();
        return;
      }
      setDraft(submittedDraft);
      setFields(result.fields ?? {});
      setError(result.error);
      setStatus(result.status);
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof ApiError && cause.status >= 400 && cause.status < 500
            ? cause.message
            : GENERIC_ERROR_MESSAGE,
        );
    } finally {
      pendingRef.current = false;
      if (active.current) setPending(false);
    }
  }
  return (
    <form onSubmit={save} noValidate className="min-w-0 space-y-6">
      {(error || Object.keys(fields).length > 0) && (
        <div
          ref={summary}
          role="alert"
          tabIndex={-1}
          className="rounded-input border border-danger bg-danger-bg p-3 text-danger [overflow-wrap:anywhere] focus:outline-2 focus:outline-offset-2 focus:outline-danger"
        >
          {error ? (
            <p>{error}</p>
          ) : (
            <>
              <p className="font-semibold">Kiểm tra các trường sau:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {Object.entries(fields).map(([key, message]) => (
                  <li key={key}>
                    <a
                      href={`#${id(key)}`}
                      className="underline"
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(id(key))?.focus();
                      }}
                    >
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {status === 404 && (
            <Button variant="secondary" className="mt-3" onClick={onReload}>
              Tải lại danh sách
            </Button>
          )}
        </div>
      )}
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <legend className="sr-only">Thông tin khách thuê</legend>
        <Field id={id("name")} label="Họ tên" error={fields.name}>
          {(props) => (
            <input
              {...props}
              name="name"
              autoComplete="name"
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          )}
        </Field>
        <Field
          id={id("phone")}
          label="Số điện thoại"
          error={fields.phone}
          hint="Ví dụ 0901234567 hoặc +84 901 234 567"
        >
          {(props) => (
            <input
              {...props}
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          )}
        </Field>
        <Field id={id("idNumber")} label="Số CCCD (không bắt buộc)">
          {(props) => (
            <input
              {...props}
              name="idNumber"
              type="text"
              inputMode="numeric"
              value={draft.idNumber}
              onChange={(event) => setDraft({ ...draft, idNumber: event.target.value })}
            />
          )}
        </Field>
        <Field id={id("roomId")} label="Phòng (không bắt buộc)">
          {(props) => (
            <select
              {...props}
              name="roomId"
              value={draft.roomId}
              onChange={(event) => setDraft({ ...draft, roomId: event.target.value })}
            >
              <option value="">Chưa xếp phòng</option>
              {draft.roomId && !rooms.some((room) => room.id === draft.roomId) && (
                <option value={draft.roomId}>Phòng chưa cập nhật</option>
              )}
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        {renter && (
          <Field id={id("status")} label="Trạng thái thuê">
            {(props) => (
              <select
                {...props}
                value={draft.status ?? "active"}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as RenterResponse["status"] })
                }
              >
                <option value="active">Đang thuê</option>
                <option value="inactive">Đã kết thúc hợp đồng</option>
              </select>
            )}
          </Field>
        )}
        {renter && (
          <section aria-label="Ảnh CCCD" className="space-y-3 border-t border-border pt-4">
            <h3 className="font-semibold text-text">Ảnh CCCD · chỉ quản lý xem</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["front", "back"] as const).map((side) => (
                <FileUpload
                  key={side}
                  id={id(`cccd-${side}`)}
                  label={`CCCD mặt ${side === "front" ? "trước" : "sau"} · ${cccdStatus[side] ? "đã tải" : "chưa có ảnh"}`}
                  maxBytes={5_000_000}
                  pending={cccdPending}
                  onFiles={(files) => {
                    if (files[0]) void uploadCccd(side, files[0]);
                  }}
                />
              ))}
            </div>
            {cccdError && (
              <p role="alert" className="text-sm text-danger">
                {cccdError}
              </p>
            )}
          </section>
        )}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" pending={pending} pendingLabel="Đang lưu…">
          {renter ? "Lưu thay đổi" : "Thêm khách thuê"}
        </Button>
      </div>
    </form>
  );
}
