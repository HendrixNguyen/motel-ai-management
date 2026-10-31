"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  createContract,
  createContractTemplate,
  copyContractTemplateFromCatalog,
  deleteContractTemplate,
  listContractTemplateCatalog,
  sendContract,
  terminateContract,
  updateContract,
  updateContractTemplate,
} from "@/lib/api/contracts.client";
import { copyCatalogTemplate as copyCatalogTemplateApi } from "@/lib/api/motel-setup.client";
import ContractTemplatePicker from "./contract-template-picker";
import type {
  ContractResponse,
  ContractStatus,
  ContractTemplateCatalogResponse,
  ContractTemplateResponse,
  RenterResponse,
  RoomResponse,
  TemplatePreview,
} from "@/lib/api/types";
import {
  contractPartyNames,
  contractDraftFromContract,
  contractStatusLabel,
  createContractDraft,
  draftTemplateUpdate,
  prepareContractInput,
  prepareContractPatch,
  type ContractDraft,
} from "@/lib/contract-presentation";
import { formatVnd } from "@/lib/format/vnd";

const tones: Record<ContractStatus, BadgeTone> = {
  draft: "warning",
  active: "success",
  expired: "neutral",
  terminated: "danger",
};

export default function ContractManagementClient({
  motelId,
  renters,
  rooms,
  contracts,
  templates,
}: {
  motelId: string;
  renters: RenterResponse[];
  rooms: RoomResponse[];
  contracts: ContractResponse[];
  templates: ContractTemplateResponse[];
}) {
  const router = useRouter();
  const notify = useToast();
  const [rows, setRows] = useState(contracts);
  const [templateRows, setTemplateRows] = useState(templates);
  const [catalogRows, setCatalogRows] = useState<ContractTemplateCatalogResponse[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [dialog, setDialog] = useState<"create" | "templates" | { edit: ContractResponse } | null>(
    null,
  );
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplateResponse | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [selectedCatalogTemplate, setSelectedCatalogTemplate] = useState<TemplatePreview | null>(
    null,
  );
  const [isDefaultCatalog, setIsDefaultCatalog] = useState(false);
  const [draft, setDraft] = useState<ContractDraft>(() =>
    createContractDraft(renters, rooms, templates),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ContractDraft, string>>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function openTemplates() {
    setFormError("");
    setDialog("templates");
    if (catalogLoaded) return;
    try {
      setCatalogRows(await listContractTemplateCatalog());
      setCatalogLoaded(true);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Không thể tải mẫu hệ thống");
    }
  }

  async function copyCatalogTemplate(template: ContractTemplateCatalogResponse) {
    setPending(true);
    setCatalogError("");
    try {
      const copied = await copyContractTemplateFromCatalog(motelId, {
        catalogKey: template.key,
        catalogVersion: template.version,
      });
      setTemplateRows((current) => [copied, ...current]);
      notify({ message: `Đã sao chép mẫu “${template.name}” vào nhà trọ này` });
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Không thể sao chép mẫu");
    } finally {
      setPending(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = prepareContractInput(motelId, draft, renters, rooms, templateRows);
    if (!result.ok) {
      setErrors(result.errors);
      setFormError("Kiểm tra các trường hợp đồng");
      return;
    }
    setPending(true);
    setErrors({});
    setFormError("");
    try {
      const created = await createContract(motelId, result.input);
      setRows((current) => [created, ...current]);
      setDialog(null);
      notify({ message: "Đã tạo hợp đồng nháp" });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể tạo hợp đồng");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, contract: ContractResponse) {
    event.preventDefault();
    const result = prepareContractPatch(motelId, contract, draft, renters, rooms, templateRows);
    if (!result.ok) {
      setErrors(result.errors);
      setFormError("Kiểm tra các trường hợp đồng");
      return;
    }
    setPending(true);
    setErrors({});
    setFormError("");
    try {
      const updated = await updateContract(motelId, contract.id, result.input);
      setRows((current) => current.map((row) => (row.id === contract.id ? updated : row)));
      setDialog(null);
      notify({ message: "Đã lưu bản nháp hợp đồng" });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể lưu hợp đồng");
    } finally {
      setPending(false);
    }
  }

  async function transition(contract: ContractResponse, action: "send" | "terminate") {
    setPending(true);
    setFormError("");
    try {
      const updated =
        action === "send"
          ? await sendContract(motelId, contract.id)
          : await terminateContract(motelId, contract.id);
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify({
        message: action === "send" ? "Đã ghi nhận yêu cầu gửi hợp đồng" : "Đã chấm dứt hợp đồng",
      });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể cập nhật hợp đồng");
    } finally {
      setPending(false);
    }
  }

  async function saveTemplate(
    event: FormEvent<HTMLFormElement>,
    existing?: ContractTemplateResponse,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();
    if (
      !name ||
      (!existing && (!title || !content)) ||
      (existing && existing.clauses.length > 1 && !String(form.get("clausesJson") ?? "").trim())
    ) {
      setFormError(
        existing
          ? "Nhập tên mẫu và giữ nguyên danh sách điều khoản"
          : "Nhập tên mẫu và đầy đủ điều khoản",
      );
      return;
    }
    setPending(true);
    setFormError("");
    try {
      let clauses: ContractTemplateResponse["clauses"];
      if (existing) {
        try {
          clauses = JSON.parse(
            String(form.get("clausesJson") ?? JSON.stringify(existing.clauses)),
          ) as ContractTemplateResponse["clauses"];
        } catch {
          clauses = existing.clauses;
        }
      } else clauses = [{ title, content }];
      if (clauses.some((clause) => !clause.title.trim() || !clause.content.trim())) {
        setFormError("Mỗi điều khoản cần tiêu đề và nội dung");
        return;
      }
      const saved = existing
        ? await updateContractTemplate(
            motelId,
            existing.id,
            draftTemplateUpdate(existing, name, clauses),
          )
        : await createContractTemplate(motelId, { name, clauses });
      if (existing)
        setTemplateRows((current) =>
          current.map((item) => (item.id === existing.id ? saved : item)),
        );
      else setTemplateRows((current) => [saved, ...current]);
      setEditingTemplate(null);
      notify({ message: existing ? "Đã cập nhật mẫu" : "Đã tạo mẫu hợp đồng" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể lưu mẫu hợp đồng");
    } finally {
      setPending(false);
    }
  }

  async function removeTemplate(template: ContractTemplateResponse) {
    if (!window.confirm(`Xóa mẫu “${template.name}”?`)) return;
    setPending(true);
    setFormError("");
    try {
      await deleteContractTemplate(motelId, template.id);
      setTemplateRows((current) => current.filter((item) => item.id !== template.id));
      notify({ message: "Đã xóa mẫu hợp đồng" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể xóa mẫu hợp đồng");
    } finally {
      setPending(false);
    }
  }

  async function handleCopyFromCatalog() {
    if (!selectedCatalogTemplate || selectedCatalogTemplate.selection.kind !== "catalog") return;
    setPending(true);
    setFormError("");
    try {
      const created = await copyCatalogTemplateApi(motelId, {
        catalogKey: selectedCatalogTemplate.selection.key,
        catalogVersion: selectedCatalogTemplate.selection.version,
        isDefault: isDefaultCatalog,
      });
      setTemplateRows((current) => {
        const next = isDefaultCatalog ? current.map((t) => ({ ...t, isDefault: false })) : current;
        return [created, ...next];
      });
      setCatalogPickerOpen(false);
      notify({ message: "Đã thêm mẫu hợp đồng từ thư viện" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể sao chép mẫu từ thư viện");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setDraft(createContractDraft(renters, rooms, templateRows));
            setErrors({});
            setFormError("");
            setDialog("create");
          }}
        >
          Tạo hợp đồng
        </Button>
        <Button variant="secondary" onClick={() => void openTemplates()}>
          Mẫu hợp đồng
        </Button>
      </div>
      {formError && (
        <p role="alert" className="rounded-input border border-danger bg-danger-bg p-3 text-danger">
          {formError}
        </p>
      )}
      {!rows.length ? (
        <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-heading text-lg font-semibold text-text">Chưa có hợp đồng</p>
          <p className="mt-2 text-text-muted">Tạo hợp đồng nháp cho khách thuê đang hoạt động.</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              renters={renters}
              rooms={rooms}
              pending={pending}
              onTransition={transition}
              onEdit={() => {
                setDraft(contractDraftFromContract(contract));
                setErrors({});
                setFormError("");
                setDialog({ edit: contract });
              }}
            />
          ))}
        </div>
      )}
      {dialog === "create" && (
        <Modal
          open
          onClose={() => {
            if (!pending) setDialog(null);
          }}
          title="Tạo hợp đồng nháp"
          description="Chỉ khách thuê đang hoạt động và phòng thuộc nhà trọ này mới hợp lệ."
        >
          <form onSubmit={create} noValidate className="space-y-4">
            <Field id="contract-renter" label="Khách thuê" error={errors.renterId}>
              {(props) => (
                <select
                  {...props}
                  required
                  value={draft.renterId}
                  onChange={(event) => setDraft({ ...draft, renterId: event.target.value })}
                >
                  <option value="">Chọn khách thuê</option>
                  {renters
                    .filter((item) => item.motelId === motelId && item.status === "active")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.phone}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field id="contract-room" label="Phòng" error={errors.roomId}>
              {(props) => (
                <select
                  {...props}
                  required
                  value={draft.roomId}
                  onChange={(event) => setDraft({ ...draft, roomId: event.target.value })}
                >
                  <option value="">Chọn phòng</option>
                  {rooms
                    .filter((item) => item.motelId === motelId && item.status !== "maintenance")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field id="contract-template" label="Mẫu điều khoản" error={errors.templateId}>
              {(props) => (
                <select
                  {...props}
                  value={draft.templateId}
                  onChange={(event) => {
                    const template = templateRows.find(
                      (item) => item.id === event.target.value && item.motelId === motelId,
                    );
                    setDraft({
                      ...draft,
                      templateId: event.target.value,
                      clauses: template ? template.clauses.map((clause) => ({ ...clause })) : [],
                    });
                  }}
                >
                  <option value="">Điều khoản tùy chỉnh</option>
                  {templateRows
                    .filter((item) => item.motelId === motelId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.isDefault ? " · Mặc định" : ""}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="contract-start" label="Ngày bắt đầu" error={errors.startDate}>
                {(props) => (
                  <input
                    {...props}
                    type="date"
                    required
                    value={draft.startDate}
                    onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                  />
                )}
              </Field>
              <Field id="contract-end" label="Ngày kết thúc" error={errors.endDate}>
                {(props) => (
                  <input
                    {...props}
                    type="date"
                    required
                    value={draft.endDate}
                    onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                  />
                )}
              </Field>
              <Field id="contract-rent" label="Tiền thuê/tháng" error={errors.monthlyRent}>
                {(props) => (
                  <input
                    {...props}
                    inputMode="numeric"
                    required
                    value={draft.monthlyRent}
                    onChange={(event) => setDraft({ ...draft, monthlyRent: event.target.value })}
                  />
                )}
              </Field>
              <Field id="contract-deposit" label="Tiền cọc" error={errors.deposit}>
                {(props) => (
                  <input
                    {...props}
                    inputMode="numeric"
                    required
                    value={draft.deposit}
                    onChange={(event) => setDraft({ ...draft, deposit: event.target.value })}
                  />
                )}
              </Field>
            </div>
            <ClauseEditor
              clauses={draft.clauses}
              error={errors.clauses}
              onChange={(clauses) => setDraft({ ...draft, clauses, templateId: "" })}
            />
            {formError && (
              <p role="alert" className="rounded-input bg-danger-bg p-3 text-danger">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" disabled={pending} onClick={() => setDialog(null)}>
                Hủy
              </Button>
              <Button type="submit" pending={pending} pendingLabel="Đang tạo…">
                Tạo hợp đồng nháp
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog && typeof dialog === "object" && (
        <Modal
          open
          onClose={() => {
            if (!pending) setDialog(null);
          }}
          title="Chỉnh sửa hợp đồng nháp"
          description="Chỉ có thể cập nhật thời hạn, tiền thuê, tiền cọc và điều khoản của bản nháp."
        >
          <form onSubmit={(event) => saveEdit(event, dialog.edit)} noValidate className="space-y-4">
            <Field id="edit-contract-start" label="Ngày bắt đầu" error={errors.startDate}>
              {(props) => (
                <input
                  {...props}
                  type="date"
                  required
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                />
              )}
            </Field>
            <Field id="edit-contract-end" label="Ngày kết thúc" error={errors.endDate}>
              {(props) => (
                <input
                  {...props}
                  type="date"
                  required
                  value={draft.endDate}
                  onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                />
              )}
            </Field>
            <Field id="edit-contract-rent" label="Tiền thuê/tháng" error={errors.monthlyRent}>
              {(props) => (
                <input
                  {...props}
                  inputMode="numeric"
                  required
                  value={draft.monthlyRent}
                  onChange={(event) => setDraft({ ...draft, monthlyRent: event.target.value })}
                />
              )}
            </Field>
            <Field id="edit-contract-deposit" label="Tiền cọc" error={errors.deposit}>
              {(props) => (
                <input
                  {...props}
                  inputMode="numeric"
                  required
                  value={draft.deposit}
                  onChange={(event) => setDraft({ ...draft, deposit: event.target.value })}
                />
              )}
            </Field>
            <ClauseEditor
              clauses={draft.clauses}
              error={errors.clauses}
              onChange={(clauses) => setDraft({ ...draft, clauses, templateId: "" })}
            />
            {formError && (
              <p role="alert" className="rounded-input bg-danger-bg p-3 text-danger">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" disabled={pending} onClick={() => setDialog(null)}>
                Hủy
              </Button>
              <Button type="submit" pending={pending}>
                Lưu bản nháp
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "templates" && (
        <Modal
          open
          onClose={() => {
            if (!pending) setDialog(null);
          }}
          title="Mẫu hợp đồng"
          description="Mẫu hệ thống là nội dung tham khảo. Hãy sao chép rồi điều chỉnh cho nhà trọ của bạn."
        >
          <div className="max-h-[65dvh] space-y-4 overflow-y-auto">
            <section className="space-y-3 rounded-input border border-primary/30 bg-canvas p-3">
              <h3 className="font-semibold">Mẫu hệ thống dùng chung</h3>
              <p className="text-sm text-text-muted">
                Mẫu chỉ để tham khảo, chưa được thẩm định pháp lý. Bản sao thuộc nhà trọ này; chỉnh
                sửa không ảnh hưởng mẫu hệ thống hoặc nhà trọ khác.
              </p>
              {!catalogRows.length && !catalogError && (
                <p role="status" className="text-sm text-text-muted">
                  Đang tải mẫu hợp đồng…
                </p>
              )}
              {catalogRows.map((item) => (
                <article
                  key={`${item.key}:${item.version}`}
                  className="rounded-input border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-sm text-text-muted">{item.description}</p>
                    </div>
                    <Badge label={`v${item.version}`} tone="neutral" />
                  </div>
                  <details className="mt-2">
                    <summary className="min-h-10 cursor-pointer content-center text-sm font-medium">
                      Xem {item.clauses.length} điều khoản
                    </summary>
                    {item.clauses.map((clause, index) => (
                      <div key={index} className="mt-2">
                        <p className="font-medium">{clause.title}</p>
                        <p className="whitespace-pre-wrap text-sm text-text-muted">
                          {clause.content}
                        </p>
                      </div>
                    ))}
                  </details>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    disabled={pending || templateRows.some((row) => row.name === item.name)}
                    pending={pending}
                    onClick={() => void copyCatalogTemplate(item)}
                  >
                    {templateRows.some((row) => row.name === item.name)
                      ? "Đã có trong nhà trọ"
                      : "Sao chép vào nhà trọ"}
                  </Button>
                </article>
              ))}
              {catalogError && (
                <p role="alert" className="text-sm text-danger">
                  {catalogError}
                </p>
              )}
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold">Mẫu riêng của nhà trọ</h3>
              {templateRows
                .filter((item) => item.motelId === motelId)
                .map((item) => (
                  <article key={item.id} className="rounded-input border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge
                        label={item.isDefault ? "Mặc định" : "Mẫu"}
                        tone={item.isDefault ? "success" : "neutral"}
                      />
                    </div>
                    {item.clauses.map((clause, index) => (
                      <div key={index} className="mt-2">
                        <p className="font-medium">{clause.title}</p>
                        <p className="whitespace-pre-wrap text-text-muted">{clause.content}</p>
                      </div>
                    ))}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setEditingTemplate(item)}>
                        Sửa mẫu {item.name}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={item.isDefault || pending}
                        onClick={() => void removeTemplate(item)}
                      >
                        Xóa mẫu {item.name}
                      </Button>
                    </div>
                  </article>
                ))}
              {editingTemplate ? (
                <form
                  onSubmit={(event) => void saveTemplate(event, editingTemplate)}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <h3 className="font-semibold">Sửa mẫu</h3>
                  <Field id="template-edit-name" label="Tên mẫu">
                    {(props) => (
                      <input {...props} name="name" defaultValue={editingTemplate.name} required />
                    )}
                  </Field>
                  <Field id="template-edit-title" label="Tiêu đề điều khoản">
                    {(props) => (
                      <input
                        {...props}
                        name="title"
                        defaultValue={editingTemplate.clauses[0]?.title ?? ""}
                        required
                      />
                    )}
                  </Field>
                  <Field id="template-edit-content" label="Nội dung điều khoản">
                    {(props) => (
                      <textarea
                        {...props}
                        name="content"
                        rows={4}
                        defaultValue={editingTemplate.clauses
                          .map((clause) => `${clause.title}: ${clause.content}`)
                          .join("\n")}
                        required
                      />
                    )}
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingTemplate(null)}
                    >
                      Hủy sửa
                    </Button>
                    <Button type="submit" pending={pending}>
                      Cập nhật mẫu
                    </Button>
                  </div>
                </form>
              ) : catalogPickerOpen ? (
                <div className="space-y-4 border-t border-border pt-4">
                  <h3 className="font-semibold">Chọn mẫu từ thư viện</h3>
                  <ContractTemplatePicker
                    value={selectedCatalogTemplate}
                    onChange={setSelectedCatalogTemplate}
                  />
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={isDefaultCatalog}
                      onChange={(e) => setIsDefaultCatalog(e.target.checked)}
                    />
                    Đặt làm mẫu mặc định cho nhà trọ này
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setCatalogPickerOpen(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      disabled={!selectedCatalogTemplate || pending}
                      onClick={() => void handleCopyFromCatalog()}
                    >
                      Áp dụng mẫu
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setCatalogPickerOpen(true)}
                    >
                      Chọn mẫu có sẵn
                    </Button>
                  </div>
                  <form onSubmit={(event) => void saveTemplate(event)} className="space-y-3">
                    <h3 className="font-semibold">Hoặc tự tạo mẫu mới</h3>
                    <Field id="template-name" label="Tên mẫu">
                      {(props) => <input {...props} name="name" required />}
                    </Field>
                    <Field id="template-title" label="Tiêu đề điều khoản">
                      {(props) => <input {...props} name="title" required />}
                    </Field>
                    <Field id="template-content" label="Nội dung điều khoản">
                      {(props) => <textarea {...props} name="content" rows={4} required />}
                    </Field>
                    <Button type="submit" pending={pending}>
                      Lưu mẫu
                    </Button>
                  </form>
                </div>
              )}
            </section>
            {formError && (
              <p role="alert" className="text-danger">
                {formError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContractCard({
  contract,
  renters,
  rooms,
  pending,
  onTransition,
  onEdit,
}: {
  contract: ContractResponse;
  renters: RenterResponse[];
  rooms: RoomResponse[];
  pending: boolean;
  onTransition: (contract: ContractResponse, action: "send" | "terminate") => Promise<void>;
  onEdit: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const party = contractPartyNames(contract, renters, rooms);
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">Phòng {party.room}</p>
          <h2 className="mt-1 [overflow-wrap:anywhere] font-heading text-lg font-semibold text-text">
            {party.renter}
          </h2>
        </div>
        <Badge label={contractStatusLabel(contract.status)} tone={tones[contract.status]} />
      </div>
      <dl className="mt-0 grid min-w-0 gap-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <Row label="Thời hạn" value={`${contract.startDate} – ${contract.endDate}`} />
        <Row label="Tiền thuê" value={formatVnd(contract.monthlyRent)} />
        <Row label="Tiền cọc" value={formatVnd(contract.deposit)} />
        <Row
          label="Xác nhận của người thuê"
          value={
            contract.consentAcceptedAt
              ? "Đã xác nhận qua phiên đăng nhập"
              : contract.managerSentAt
                ? "Đã gửi liên kết · chờ xác nhận"
                : "Chưa gửi liên kết"
          }
        />
      </dl>
      <div className="mt-auto flex min-w-0 flex-wrap gap-2 border-t border-border bg-canvas/60 p-4 sm:p-5">
        <Button variant="secondary" onClick={() => setDetailOpen(true)}>
          Chi tiết hợp đồng
        </Button>
        {contract.status === "draft" && (
          <>
            <Button variant="secondary" disabled={pending} onClick={onEdit}>
              Sửa bản nháp
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void onTransition(contract, "send")}
            >
              Yêu cầu gửi
            </Button>
          </>
        )}
        {contract.status === "active" && (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Chấm dứt hợp đồng của ${party.renter} tại ${party.room}?`))
                void onTransition(contract, "terminate");
            }}
          >
            Chấm dứt
          </Button>
        )}
      </div>
      {detailOpen && (
        <Modal
          open
          onClose={() => setDetailOpen(false)}
          title={`Hợp đồng · ${party.renter}`}
          description={party.room}
        >
          <ContractDetail contract={contract} />
        </Modal>
      )}
    </article>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-text">{value}</dd>
    </div>
  );
}
function ContractDetail({ contract }: { contract: ContractResponse }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Trạng thái" value={contractStatusLabel(contract.status)} />
        <Row label="Bắt đầu" value={contract.startDate} />
        <Row label="Kết thúc" value={contract.endDate} />
        <Row label="Tiền thuê/tháng" value={formatVnd(contract.monthlyRent)} />
        <Row label="Tiền cọc" value={formatVnd(contract.deposit)} />
        <Row label="Ngày gửi liên kết" value={contract.managerSentAt ?? "Chưa gửi"} />
        <Row label="Thời điểm xác nhận" value={contract.consentAcceptedAt ?? "Chưa xác nhận"} />
        {contract.consentEvidence && (
          <Row label="Phiên bản đã đồng ý" value={contract.consentEvidence.termsVersion} />
        )}
        <Row
          label="Phương thức"
          value={
            contract.consentMethod === "session_consent"
              ? "Đồng ý trong phiên renter"
              : "Chưa xác nhận"
          }
        />
      </dl>
      <section>
        <h3 className="font-semibold">Điều khoản snapshot</h3>
        {contract.clauses.length ? (
          <ol className="mt-2 list-decimal space-y-3 pl-5">
            {contract.clauses.map((clause, index) => (
              <li key={`${clause.title}-${index}`}>
                <p className="font-medium">{clause.title}</p>
                <p className="whitespace-pre-wrap text-text-muted">{clause.content}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-text-muted">Hợp đồng không có điều khoản kèm theo.</p>
        )}
      </section>
    </div>
  );
}
function ClauseEditor({
  clauses,
  error,
  onChange,
}: {
  clauses: { title: string; content: string }[];
  error?: string;
  onChange: (clauses: { title: string; content: string }[]) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Điều khoản lưu cùng hợp đồng</h3>
      {clauses.map((clause, index) => (
        <div key={index} className="space-y-2 rounded-input border border-border p-3">
          <Field id={`clause-title-${index}`} label={`Tiêu đề ${index + 1}`}>
            {(props) => (
              <input
                {...props}
                value={clause.title}
                onChange={(event) =>
                  onChange(
                    clauses.map((item, i) =>
                      i === index ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
              />
            )}
          </Field>
          <Field id={`clause-content-${index}`} label={`Nội dung ${index + 1}`}>
            {(props) => (
              <textarea
                {...props}
                rows={3}
                value={clause.content}
                onChange={(event) =>
                  onChange(
                    clauses.map((item, i) =>
                      i === index ? { ...item, content: event.target.value } : item,
                    ),
                  )
                }
              />
            )}
          </Field>
          <Button variant="ghost" onClick={() => onChange(clauses.filter((_, i) => i !== index))}>
            Xóa điều khoản {index + 1}
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => onChange([...clauses, { title: "", content: "" }])}
      >
        Thêm điều khoản
      </Button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
