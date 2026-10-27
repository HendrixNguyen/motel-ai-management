"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import ContractTemplatePicker from "./contract-template-picker";
import {
  getMotelSetupResult,
  previewOwnedTemplate,
  submitMotelSetup,
} from "@/lib/api/motel-setup.client";
import { listContractTemplates } from "@/lib/api/contracts.client";
import type {
  ContractTemplateResponse,
  MotelResponse,
  SetupRoomInput,
  TemplatePreview,
} from "@/lib/api/types";
import {
  applyMotelCopy,
  buildSetupInput,
  parseSetupDraft,
  serializeSetupDraft,
  type CopyGroups,
  type StoredSetupDraft,
} from "@/lib/motel-setup";
import { createMotelDraft, prepareMotelInput, type MotelDraft } from "@/lib/motel-form";

export interface MotelSetupWizardProps {
  open: boolean;
  onClose: () => void;
  motels: MotelResponse[];
  managerId: string;
}

export default function MotelSetupWizard({
  open,
  onClose,
  motels,
  managerId,
}: MotelSetupWizardProps) {
  const router = useRouter();
  const notify = useToast();
  const summaryRef = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const id = (f: string) => `${prefix}-${f}`;

  const storageKey = `motel-setup-draft:${managerId}`;

  const [initialDraftData] = useState<StoredSetupDraft | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const saved = sessionStorage.getItem(`motel-setup-draft:${managerId}`);
      return saved ? parseSetupDraft(saved) : null;
    } catch {
      return null;
    }
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mode, setMode] = useState<"full" | "quick">(() => initialDraftData?.mode ?? "full");
  const [draft, setDraft] = useState<MotelDraft>(() => {
    const base = createMotelDraft();
    if (initialDraftData) {
      return {
        ...base,
        name: initialDraftData.motel.name,
        address: initialDraftData.motel.address,
        electricityPrice: initialDraftData.motel.electricityPrice,
        waterPrice: initialDraftData.motel.waterPrice,
        otherFees: initialDraftData.motel.otherFees,
      };
    }
    return base;
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState(false);
  const [requestId, setRequestId] = useState<string>(
    () => initialDraftData?.pendingRequestId ?? crypto.randomUUID(),
  );
  const previewGeneration = useRef(0);

  const [sourceMotelId, setSourceMotelId] = useState<string>("");
  const [copyGroups, setCopyGroups] = useState<CopyGroups>({ bank: false, services: false });
  const [copyTemplate, setCopyTemplate] = useState<boolean>(false);
  const [sourceTemplates, setSourceTemplates] = useState<ContractTemplateResponse[]>([]);
  const [selectedSourceTemplateId, setSelectedSourceTemplateId] = useState<string>("");

  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null);
  const [templateSourceType, setTemplateSourceType] = useState<"catalog" | "owned">("catalog");

  const [rooms, setRooms] = useState<SetupRoomInput[]>(() => initialDraftData?.rooms ?? []);
  const [genPrefix, setGenPrefix] = useState<string>("");
  const [genStart, setGenStart] = useState<string>("101");
  const [genCount, setGenCount] = useState<string>("10");
  const [genFloor, setGenFloor] = useState<string>("1");
  const [genPrice, setGenPrice] = useState<string>("2500000");

  useEffect(() => {
    if (!open) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      const parsed = saved ? parseSetupDraft(saved) : null;
      if (parsed?.pendingRequestId) {
        getMotelSetupResult(parsed.pendingRequestId)
          .then((res) => {
            sessionStorage.removeItem(storageKey);
            notify({ message: "Nhà trọ đã được tạo từ trước" });
            window.dispatchEvent(new CustomEvent("motel-updated", { detail: res }));
            onClose();
            router.refresh();
          })
          .catch((err: unknown) => {
            if (err && typeof err === "object" && "status" in err && err.status === 410) {
              setTerminalRequest(true);
              setError("Kết quả yêu cầu cũ đã bị xóa. Không thể gửi lại bằng mã yêu cầu này.");
            }
          });
      }
    } catch {
      // ignore
    }
  }, [open, storageKey, notify, onClose, router]);

  useEffect(() => {
    if (!open) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      const parsed = saved ? parseSetupDraft(saved) : null;
      if (parsed?.pendingRequestId) return;
      const stored: StoredSetupDraft = {
        version: 1,
        mode,
        motel: {
          name: draft.name,
          address: draft.address,
          electricityPrice: draft.electricityPrice,
          waterPrice: draft.waterPrice,
          otherFees: draft.otherFees,
        },
        template: selectedTemplate?.selection ?? null,
        rooms,
        pendingRequestId: pending ? requestId : null,
      };
      sessionStorage.setItem(storageKey, serializeSetupDraft(stored));
    } catch {
      // storage unavailable
    }
  }, [open, mode, draft, selectedTemplate, rooms, pending, requestId, storageKey]);

  useEffect(() => {
    if (!sourceMotelId) return;
    let active = true;
    listContractTemplates(sourceMotelId)
      .then((tpls) => {
        if (!active) return;
        setSourceTemplates(tpls);
        const def = tpls.find((t) => t.isDefault) ?? tpls[0];
        if (def) setSelectedSourceTemplateId(def.id);
      })
      .catch(() => {
        if (active) setSourceTemplates([]);
      });
    return () => {
      active = false;
    };
  }, [sourceMotelId]);

  function handleApplyCopy() {
    const src = motels.find((m) => m.id === sourceMotelId);
    if (!src) return;

    const servicesEdited = draft.electricityPrice !== "" || draft.waterPrice !== "" || draft.otherFees.length > 0;
    if (
      (copyGroups.bank && draft.bankEnabled && (draft.bankAccount.accountNumber || draft.bankAccount.bankCode)) ||
      (copyGroups.services && servicesEdited)
    ) {
      if (!window.confirm("Ghi đè cấu hình đã nhập?")) return;
    }
    const generation = ++previewGeneration.current;
    const sourceId = sourceMotelId;
    const templateId = selectedSourceTemplateId;
    const shouldPreview = copyTemplate && Boolean(templateId);
    if (shouldPreview) setSelectedTemplate(null);


    const nextDraft = applyMotelCopy(draft, src, copyGroups);
    setDraft(nextDraft);

    if (shouldPreview) {
      previewOwnedTemplate(src.id, templateId)
        .then((preview) => {
          if (generation !== previewGeneration.current || sourceId !== sourceMotelId || templateId !== selectedSourceTemplateId) return;
          setSelectedTemplate(preview);
          setTemplateSourceType("owned");
        })
        .catch(() => {
          if (generation === previewGeneration.current && sourceId === sourceMotelId && templateId === selectedSourceTemplateId) {
            setError("Không thể tải mẫu từ nhà trọ đã chọn");
          }
        });
    }
  }

  function validateStep1(): boolean {
    const parsed = prepareMotelInput(draft);
    if (!parsed.ok) {
      setFields(parsed.fields ?? {});
      setError(null);
      setTimeout(() => summaryRef.current?.focus(), 0);
      return false;
    }
    setFields({});
    setError(null);
    return true;
  }

  function handleNextFromStep1() {
    if (!validateStep1()) return;
    setMode("full");
    setStep(2);
  }

  function handleQuickSkip() {
    if (!validateStep1()) return;
    setMode("quick");
    setStep(4);
  }

  function handleGenerateRooms() {
    const count = parseInt(genCount, 10);
    if (isNaN(count) || count < 1 || count > 100) {
      setError("Số lượng phòng từ 1 đến 100");
      return;
    }
    const startNum = parseInt(genStart, 10) || 1;
    const floor = genFloor ? parseInt(genFloor, 10) : null;
    const priceDigits = genPrice.replace(/\D/g, "");
    if (!priceDigits) {
      setError("Vui lòng nhập giá thuê");
      return;
    }

    const generated: SetupRoomInput[] = [];
    for (let i = 0; i < count; i++) {
      generated.push({
        name: `${genPrefix}${startNum + i}`,
        basePrice: priceDigits,
        ...(floor !== null ? { floor } : {}),
      });
    }
    setRooms(generated);
    setError(null);
  }

  async function handleSubmit() {
    if (terminalRequest) return;
    const parsed = prepareMotelInput(draft);
    if (!parsed.ok) {
      setError("Thông tin nhà trọ không hợp lệ");
      setStep(1);
      return;
    }

    let input;
    try {
      input = buildSetupInput(
        requestId,
        mode,
        parsed.input,
        selectedTemplate?.selection ?? null,
        rooms,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cấu hình chưa hợp lệ");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await submitMotelSetup(input);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      notify({ message: mode === "quick" ? "Đã tạo nhanh nhà trọ" : "Đã tạo nhà trọ thành công" });
      window.dispatchEvent(new CustomEvent("motel-updated", { detail: res }));
      onClose();
      router.refresh();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && err.status === 410) {
        setTerminalRequest(true);
      }
      setError(err instanceof Error ? err.message : "Không thể tạo nhà trọ. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  const selectedSource = motels.find((m) => m.id === sourceMotelId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === 1
          ? "Bước 1: Thông tin nhà trọ"
          : step === 2
            ? "Bước 2: Mẫu hợp đồng"
            : step === 3
              ? "Bước 3: Danh sách phòng"
              : "Bước 4: Xác nhận và hoàn tất"
      }
      description={
        step === 1
          ? "Nhập thông tin cơ bản và đơn giá dịch vụ."
          : step === 2
            ? "Chọn mẫu hợp đồng mẫu áp dụng cho nhà trọ."
            : step === 3
              ? "Thiết lập danh sách các phòng và giá thuê."
              : "Kiểm tra lại toàn bộ thông tin trước khi hoàn tất."
      }
    >
      <div className="space-y-6">
        {(error || (step === 1 && Object.keys(fields).length > 0)) && (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-input border border-danger bg-danger-bg p-3 text-danger focus:outline-2 focus:outline-offset-2 focus:outline-danger"
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
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {motels.length > 0 && (
              <div className="rounded-input border border-border bg-canvas/40 p-4 space-y-3">
                <div className="font-semibold text-text">Sao chép từ nhà trọ đang có</div>
                <Field id={id("sourceMotel")} label="Chọn nhà trọ nguồn">
                  {(props) => (
                    <select
                      {...props}
                      value={sourceMotelId}
                      onChange={(e) => {
                        const val = e.target.value;
                        previewGeneration.current += 1;
                        setSelectedTemplate((current) => current?.selection.kind === "motel" ? null : current);
                        setSourceMotelId(val);
                        if (!val) {
                          setSourceTemplates([]);
                          setSelectedSourceTemplateId("");
                        }
                      }}
                    >
                      <option value="">(Không sao chép)</option>
                      {motels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                {selectedSource && (
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        disabled={!selectedSource.bankAccount}
                        checked={copyGroups.bank}
                        onChange={(e) =>
                          setCopyGroups((prev) => ({ ...prev, bank: e.target.checked }))
                        }
                      />
                      Tài khoản nhận tiền{" "}
                      {!selectedSource.bankAccount && "(Nguồn chưa có tài khoản)"}
                    </label>

                    <label className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={copyGroups.services}
                        onChange={(e) =>
                          setCopyGroups((prev) => ({ ...prev, services: e.target.checked }))
                        }
                      />
                      Giá điện, nước và phí khác
                    </label>

                    <label className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        disabled={sourceTemplates.length === 0}
                        checked={copyTemplate}
                        onChange={(e) => setCopyTemplate(e.target.checked)}
                      />
                      Mẫu hợp đồng {sourceTemplates.length === 0 && "(Nguồn chưa có mẫu)"}
                    </label>

                    {copyTemplate && sourceTemplates.length > 0 && (
                      <div className="pl-6">
                        <select
                          className="w-full rounded-input border border-border-strong p-2 text-sm"
                          value={selectedSourceTemplateId}
                          onChange={(e) => {
                        previewGeneration.current += 1;
                        setSelectedTemplate((current) => current?.selection.kind === "motel" ? null : current);
                        setSelectedSourceTemplateId(e.target.value);
                      }}
                        >
                          {sourceTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} {t.isDefault ? "(Mặc định)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Button variant="secondary" size="sm" onClick={handleApplyCopy}>
                      Áp dụng
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Field id={id("name")} label="Tên nhà trọ" error={fields.name}>
              {(props) => (
                <input
                  {...props}
                  value={draft.name}
                  required
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
              )}
            </Field>

            <Field id={id("address")} label="Địa chỉ (không bắt buộc)" error={fields.address}>
              {(props) => (
                <textarea
                  {...props}
                  rows={2}
                  value={draft.address}
                  onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={id("electricityPrice")}
                label="Giá điện (₫/kWh)"
                error={fields.electricityPrice}
              >
                {(props) => (
                  <input
                    {...props}
                    value={draft.electricityPrice}
                    required
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, electricityPrice: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field id={id("waterPrice")} label="Giá nước (₫/m³)" error={fields.waterPrice}>
                {(props) => (
                  <input
                    {...props}
                    value={draft.waterPrice}
                    required
                    onChange={(e) => setDraft((prev) => ({ ...prev, waterPrice: e.target.value }))}
                  />
                )}
              </Field>
            </div>

            <fieldset className="space-y-4 border-t border-border pt-4">
              <legend className="font-heading font-semibold text-text">Tài khoản nhận tiền</legend>
              <label className="flex items-center gap-3 text-base text-text">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={draft.bankEnabled}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, bankEnabled: e.target.checked }))
                  }
                />
                Thiết lập tài khoản nhận tiền
              </label>

              {draft.bankEnabled && (
                <div className="space-y-3">
                  <Field id={id("bankCode")} label="Mã ngân hàng (BIN)" error={fields["bankAccount.bankCode"]}>
                    {(props) => (
                      <input
                        {...props}
                        value={draft.bankAccount.bankCode}
                        required
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            bankAccount: { ...prev.bankAccount, bankCode: e.target.value },
                          }))
                        }
                      />
                    )}
                  </Field>
                  <Field id={id("accountNumber")} label="Số tài khoản" error={fields["bankAccount.accountNumber"]}>
                    {(props) => (
                      <input
                        {...props}
                        value={draft.bankAccount.accountNumber}
                        required
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            bankAccount: { ...prev.bankAccount, accountNumber: e.target.value },
                          }))
                        }
                      />
                    )}
                  </Field>
                  <Field id={id("accountName")} label="Tên chủ tài khoản" error={fields["bankAccount.accountName"]}>
                    {(props) => (
                      <input
                        {...props}
                        value={draft.bankAccount.accountName}
                        required
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            bankAccount: { ...prev.bankAccount, accountName: e.target.value },
                          }))
                        }
                      />
                    )}
                  </Field>
                </div>
              )}
            </fieldset>

            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <div className="flex gap-2">
                {motels.length > 0 && (
                  <Button variant="secondary" onClick={handleQuickSkip}>
                    Tạo nhanh (bỏ qua thiết lập)
                  </Button>
                )}
                <Button onClick={handleNextFromStep1}>Tiếp tục</Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-4 border-b border-border pb-3">
              <button
                type="button"
                className={`font-semibold pb-1 border-b-2 ${
                  templateSourceType === "catalog"
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted"
                }`}
                onClick={() => setTemplateSourceType("catalog")}
              >
                Thư viện mẫu có sẵn
              </button>
              {sourceTemplates.length > 0 && (
                <button
                  type="button"
                  className={`font-semibold pb-1 border-b-2 ${
                    templateSourceType === "owned"
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted"
                  }`}
                  onClick={() => setTemplateSourceType("owned")}
                >
                  Mẫu từ nhà trọ nguồn ({selectedSource?.name})
                </button>
              )}
            </div>

            {templateSourceType === "catalog" ? (
              <ContractTemplatePicker
                value={selectedTemplate?.selection.kind === "catalog" ? selectedTemplate : null}
                onChange={setSelectedTemplate}
              />
            ) : (
              <div className="space-y-3">
                <Field id={id("ownedTemplateSelect")} label="Chọn mẫu từ nhà trọ nguồn">
                  {(props) => (
                    <select
                      {...props}
                      value={
                        selectedTemplate?.selection.kind === "motel"
                          ? selectedTemplate.selection.templateId
                          : ""
                      }
                      onChange={(e) => {
                        if (!e.target.value || !selectedSource) return;
                        previewOwnedTemplate(selectedSource.id, e.target.value).then(
                          setSelectedTemplate,
                        );
                      }}
                    >
                      <option value="">(Chọn mẫu)</option>
                      {sourceTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.isDefault ? "(Mặc định)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {selectedTemplate && selectedTemplate.selection.kind === "motel" && (
                  <div className="rounded-input border border-border bg-canvas/40 p-4 space-y-3">
                    <div className="font-semibold text-text">{selectedTemplate.name}</div>
                    <div className="max-h-60 overflow-y-auto space-y-3 text-sm">
                      {selectedTemplate.clauses.map((clause, idx) => (
                        <div
                          key={idx}
                          className="border-t border-border pt-2 first:border-0 first:pt-0"
                        >
                          <p className="font-medium text-text">{clause.title}</p>
                          <p className="whitespace-pre-wrap text-text-muted mt-1">
                            {clause.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Quay lại
              </Button>
              <Button
                disabled={!selectedTemplate}
                onClick={() => setStep(3)}
              >
                Tiếp tục
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-input border border-border bg-canvas/40 p-4 space-y-3">
              <div className="font-semibold text-text">Sinh nhanh danh sách phòng</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={id("genPrefix")} label="Tiền tố phòng">
                  {(props) => (
                    <input
                      {...props}
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value)}
                    />
                  )}
                </Field>
                <Field id={id("genStart")} label="Số bắt đầu">
                  {(props) => (
                    <input
                      {...props}
                      value={genStart}
                      onChange={(e) => setGenStart(e.target.value)}
                    />
                  )}
                </Field>
                <Field id={id("genCount")} label="Số lượng phòng">
                  {(props) => (
                    <input
                      {...props}
                      value={genCount}
                      onChange={(e) => setGenCount(e.target.value)}
                    />
                  )}
                </Field>
                <Field id={id("genFloor")} label="Tầng (không bắt buộc)">
                  {(props) => (
                    <input
                      {...props}
                      value={genFloor}
                      onChange={(e) => setGenFloor(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field id={id("genPrice")} label="Giá thuê mặc định (₫)">
                {(props) => (
                  <input
                    {...props}
                    value={genPrice}
                    onChange={(e) => setGenPrice(e.target.value)}
                  />
                )}
              </Field>
              <Button variant="secondary" size="sm" onClick={handleGenerateRooms}>
                Sinh danh sách phòng
              </Button>
            </div>

            {rooms.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-text">Danh sách {rooms.length} phòng:</div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {rooms.map((room, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-input border border-border p-2 bg-surface text-sm"
                    >
                      <input
                        className="w-24 rounded-input border border-border-strong px-2 py-1"
                        value={room.name}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                          )
                        }
                      />
                      <input
                        className="w-32 rounded-input border border-border-strong px-2 py-1"
                        value={room.basePrice}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, basePrice: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <span className="text-text-muted">₫</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRooms((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Xóa
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Quay lại
              </Button>
              <Button
                disabled={rooms.length === 0}
                onClick={() => setStep(4)}
              >
                Tiếp tục
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-input border border-border bg-canvas/40 p-4 space-y-3">
              <h3 className="font-semibold text-text">Tóm tắt cấu hình</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-muted">Tên nhà trọ:</dt>
                  <dd className="font-medium text-text">{draft.name}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Chế độ tạo:</dt>
                  <dd className="font-medium text-text">
                    {mode === "quick" ? "Tạo nhanh" : "Thiết lập đầy đủ"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Số phòng:</dt>
                  <dd className="font-medium text-text">
                    {mode === "quick" ? "0 phòng (Tạo nhanh)" : `${rooms.length} phòng`}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Mẫu hợp đồng:</dt>
                  <dd className="font-medium text-text">
                    {selectedTemplate ? selectedTemplate.name : "Chưa chọn mẫu"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Giá điện:</dt>
                  <dd className="font-medium text-text">{draft.electricityPrice} ₫/kWh</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Giá nước:</dt>
                  <dd className="font-medium text-text">{draft.waterPrice} ₫/m³</dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-between border-t border-border pt-4">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => setStep(mode === "quick" ? 1 : 3)}
              >
                Quay lại
              </Button>
              <Button pending={pending} disabled={terminalRequest} pendingLabel="Đang tạo…" onClick={handleSubmit}>
                Hoàn tất thiết lập
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
