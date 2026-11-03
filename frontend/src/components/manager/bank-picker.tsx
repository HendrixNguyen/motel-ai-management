"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { FieldControlProps } from "@/components/ui/field";
import { controlClassName } from "@/components/ui/field";
import { VIETQR_BANKS } from "@/lib/vietqr-banks";

type BankPickerProps = Omit<FieldControlProps, "className"> & {
  value: string;
  onChange: (bin: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .trim();
}

export default function BankPicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className = controlClassName,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: BankPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const selectedBank = VIETQR_BANKS.find((bank) => bank.bin === value);
  const listId = `${id}-banks`;
  const results = useMemo(() => {
    const search = normalizeSearch(query);
    if (!search) return VIETQR_BANKS;
    return VIETQR_BANKS.filter((bank) =>
      normalizeSearch(`${bank.name} ${bank.shortName} ${bank.bin}`).includes(search),
    );
  }, [query]);
  const activeOption = activeIndex < 0 ? undefined : results[activeIndex];

  function selectBank(bin: string) {
    onChange(bin);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setActiveIndex(-1);
    setOpen(true);
    if (value) onChange("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index < 0 ? 0 : (index + 1) % results.length));
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter" && open && results.length) {
      event.preventDefault();
      selectBank(results[activeIndex < 0 ? 0 : activeIndex]!.bin);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        id={id}
        type="search"
        role="combobox"
        aria-label="Ngân hàng"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={open ? activeOption && `${listId}-${activeOption.bin}` : undefined}
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        required={required}
        className={className}
        placeholder="Tìm theo tên hoặc mã ngân hàng"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Danh sách ngân hàng"
          className="max-h-60 overflow-y-auto rounded-card border border-border bg-surface shadow-lg"
        >
          {results.length ? (
            results.map((bank, index) => (
              <div
                key={bank.bin}
                id={`${listId}-${bank.bin}`}
                role="option"
                aria-selected={bank.bin === value}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm text-text ${index === activeIndex ? "bg-canvas" : "hover:bg-canvas"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectBank(bank.bin)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{bank.shortName}</span>
                  <span className="block text-xs text-text-muted">{bank.name}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-text-muted">{bank.bin}</span>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-text-muted">Không tìm thấy ngân hàng phù hợp</p>
          )}
        </div>
      )}
      {selectedBank ? (
        <div className="flex items-center gap-3 rounded-card border border-border bg-canvas p-3">
          {failedLogo !== selectedBank.logo && (
            <Image
              key={selectedBank.logo}
              src={selectedBank.logo}
              alt={`Logo ${selectedBank.shortName}`}
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full bg-white object-contain"
              onError={() => setFailedLogo(selectedBank.logo)}
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-text">{selectedBank.shortName}</p>
            <p className="text-sm text-text-muted">{selectedBank.name}</p>
            <p className="font-mono text-xs text-text-muted">BIN: {selectedBank.bin}</p>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-warning">Mã BIN hiện tại: {value} (chưa có trong danh sách)</p>
      ) : null}
    </div>
  );
}
