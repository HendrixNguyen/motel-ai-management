"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { RoomResponse, RoomStatus } from "@/lib/api/types";
import { formatVnd, parseVndDigits } from "@/lib/format/vnd";
import { roomStatusLabel } from "@/lib/format/status";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createRoomFormSession, submitRoomStatus, type RoomFieldErrors } from "@/lib/room-form";

type Mode = "edit" | "status";

/** Only the forms hydrate: the cards and renter join stay on the server. */
export default function RoomEditor({
  motelId,
  room,
  empty = false,
}: {
  motelId: string;
  room?: RoomResponse;
  empty?: boolean;
}) {
  const [currentSession, setCurrentSession] = useState<{ id: number; mode: Mode }>();
  const session = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const notify = useToast();
  const show = (mode: Mode = "edit", source?: HTMLButtonElement) => {
    session.current += 1;
    if (source) trigger.current = source;
    setCurrentSession({ id: session.current, mode });
  };
  const captureTrigger = (event: React.MouseEvent<HTMLButtonElement>) =>
    show("edit", event.currentTarget);
  const close = () => {
    session.current += 1;
    setCurrentSession(undefined);
  };
  const closeFromDialog = () => {
    close();
    trigger.current?.focus();
  };
  const cancel = () => {
    closeFromDialog();
  };
  const statusMode = currentSession?.mode === "status";

  return (
    <>
      {empty ? (
        <div className="min-w-0 rounded-card border border-border bg-surface p-6 text-center">
          <h2 className="font-heading text-lg font-semibold text-text">Chưa có phòng trọ</h2>
          <p className="mx-auto mt-2 max-w-prose text-base leading-normal text-text-body">
            Thêm phòng để quản lý giá thuê và khách thuê của nhà trọ.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center rounded-input border border-primary bg-primary px-4 py-2.5 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={captureTrigger}
          >
            Thêm phòng
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-input border border-border-strong bg-surface px-4 py-2.5 font-semibold text-text hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={room ? `Chỉnh sửa ${room.name}` : undefined}
            onClick={captureTrigger}
          >
            {room ? "Chỉnh sửa" : "Thêm phòng"}
          </button>
          {room && (
            <Button
              variant="ghost"
              aria-label={`Đổi trạng thái ${room.name}`}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                show("status", event.currentTarget);
              }}
            >
              Đổi trạng thái
            </Button>
          )}
        </div>
      )}
      <Modal
        open={currentSession !== undefined}
        onClose={closeFromDialog}
        title={
          statusMode ? "Đổi trạng thái phòng" : room ? "Chỉnh sửa phòng trọ" : "Thêm phòng trọ"
        }
        description={
          statusMode
            ? "Chọn trạng thái của phòng. Khách thuê và giá thuê được quản lý riêng."
            : "Nhập tên phòng, tầng và giá thuê cơ bản mỗi tháng."
        }
      >
        {currentSession && (
          <RoomForm
            key={currentSession.id}
            motelId={motelId}
            room={room}
            mode={currentSession.mode}
            onCancel={cancel}
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
              // A dismissed pending response may refresh cards, but cannot close a newer form.
              if (session.current === currentSession.id) close();
              notify({
                message: statusMode
                  ? "Đã đổi trạng thái phòng"
                  : room
                    ? "Đã lưu thay đổi phòng trọ"
                    : "Đã thêm phòng trọ",
              });
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

export function RoomForm({
  motelId,
  room,
  mode,
  onCancel,
  onSaved,
  onReload,
  onUnauthorized,
}: {
  motelId: string;
  room?: RoomResponse;
  mode: Mode;
  onCancel: () => void;
  onSaved: () => void;
  onReload: () => void;
  onUnauthorized: () => void;
}) {
  const [original] = useState(() => (room ? structuredClone(room) : undefined));
  const [formSession] = useState(() => createRoomFormSession(motelId, original));
  const [draft, setDraft] = useState(formSession.initialDraft);
  const [statusDraft, setStatusDraft] = useState<RoomStatus>(original?.status ?? "available");
  const [fields, setFields] = useState<RoomFieldErrors>({});
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<number>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const active = useRef(true);
  const summary = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const id = (field: string) => `${prefix}-${field}`;
  const preview = parseVndDigits(draft.basePrice);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
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
    try {
      const result =
        mode === "status" && original
          ? await submitRoomStatus(motelId, original.id, statusDraft)
          : await formSession.submit(draft);
      if (result.ok) {
        onSaved();
        return;
      }
      if (result.status === 401) {
        onUnauthorized();
        return;
      }
      setFields(result.fields ?? {});
      setError(result.error);
      setStatus(result.status);
    } catch (cause) {
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
        <legend className="sr-only">
          {mode === "status" ? "Trạng thái phòng" : "Thông tin phòng trọ"}
        </legend>
        {mode === "status" ? (
          <>
            <p className="font-semibold text-text [overflow-wrap:anywhere]">{original?.name}</p>
            <Field id={id("status")} label="Trạng thái phòng">
              {(props) => (
                <select
                  {...props}
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as RoomStatus)}
                >
                  {(["available", "occupied", "maintenance"] as const).map((value) => (
                    <option key={value} value={value}>
                      {roomStatusLabel(value)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </>
        ) : (
          <>
            <Field id={id("name")} label="Tên phòng" error={fields.name}>
              {(props) => (
                <input
                  {...props}
                  name="name"
                  autoComplete="off"
                  value={draft.name}
                  required
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              )}
            </Field>
            <Field
              id={id("floor")}
              label="Tầng (không bắt buộc)"
              error={fields.floor}
              hint="Nhập số nguyên; 0 là tầng trệt. Để trống nếu chưa ghi tầng."
            >
              {(props) => (
                <input
                  {...props}
                  name="floor"
                  type="text"
                  inputMode="numeric"
                  value={draft.floor}
                  onChange={(event) => setDraft({ ...draft, floor: event.target.value })}
                />
              )}
            </Field>
            <Field
              id={id("basePrice")}
              label="Giá thuê cơ bản (₫/tháng)"
              error={fields.basePrice}
              hint="Nhập số tiền VND, ví dụ 3500000 hoặc 3.500.000"
              describedBy={preview !== null ? id("preview") : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  name="basePrice"
                  type="text"
                  inputMode="numeric"
                  required
                  value={draft.basePrice}
                  onChange={(event) => setDraft({ ...draft, basePrice: event.target.value })}
                />
              )}
            </Field>
            {preview !== null && (
              <p
                id={id("preview")}
                className="max-w-full overflow-x-auto font-semibold text-text tabular-nums whitespace-nowrap"
              >
                {formatVnd(preview)}
              </p>
            )}
          </>
        )}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" pending={pending} pendingLabel="Đang lưu…">
          {mode === "status" ? "Lưu trạng thái" : original ? "Lưu thay đổi" : "Thêm phòng"}
        </Button>
      </div>
    </form>
  );
}
