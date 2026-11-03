"use client";

import { useEffect, useState } from "react";
import Field from "@/components/ui/field";
import { listContractCatalog, previewCatalogTemplate } from "@/lib/api/motel-setup.client";
import type { CatalogSummary, TemplatePreview } from "@/lib/api/types";

export interface ContractTemplatePickerProps {
  value: TemplatePreview | null;
  onChange: (value: TemplatePreview) => void;
  disabled?: boolean;
}

export default function ContractTemplatePicker({
  value,
  onChange,
  disabled = false,
}: ContractTemplatePickerProps) {
  const [catalog, setCatalog] = useState<CatalogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listContractCatalog()
      .then((items) => {
        if (!active) return;
        setCatalog(items);
        if (items.length > 0 && !value) {
          const first = items[0]!;
          previewCatalogTemplate(first.key, first.version).then((preview) => {
            if (active) onChange(preview);
          });
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Lỗi tải catalog");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [value, onChange]);

  const selectedKey =
    value?.selection.kind === "catalog" ? `${value.selection.key}:${value.selection.version}` : "";

  async function handleSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    if (!val) return;
    const [key, versionStr] = val.split(":");
    const version = Number(versionStr);
    try {
      const preview = await previewCatalogTemplate(key!, version);
      onChange(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xem trước mẫu");
    }
  }

  return (
    <div className="space-y-4">
      <Field
        id="contract-template-catalog-picker"
        label="Mẫu từ thư viện mẫu chuẩn"
        error={error ?? undefined}
      >
        {(props) => (
          <select
            {...props}
            disabled={disabled || loading}
            value={selectedKey}
            onChange={handleSelect}
          >
            {catalog.length === 0 && <option value="">(Không có mẫu trong thư viện)</option>}
            {catalog.map((item) => (
              <option key={`${item.key}:${item.version}`} value={`${item.key}:${item.version}`}>
                {item.name} (v{item.version})
              </option>
            ))}
          </select>
        )}
      </Field>

      {value && (
        <div className="rounded-input border border-border bg-canvas/40 p-4 space-y-3">
          <div className="font-semibold text-text">{value.name}</div>
          <div className="max-h-60 overflow-y-auto space-y-3 text-sm">
            {value.clauses.map((clause, idx) => (
              <div key={idx} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <p className="font-medium text-text">{clause.title}</p>
                <p className="whitespace-pre-wrap text-text-muted mt-1">{clause.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
