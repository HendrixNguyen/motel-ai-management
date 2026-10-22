"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Chọn",
  disabled = false,
  className = "",
  id,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);
  const buttonId = id ? `${id}-button` : undefined;
  const activeIndex = options.findIndex((option) => option.value === value);
  const selectedValueRef = useRef(value);
  const disabledRef = useRef(disabled);
  const moveActive = useCallback((direction: -1 | 1) => {
    if (!options.length) return;
    const next = activeIndex < 0 ? (direction > 0 ? 0 : options.length - 1) : (activeIndex + direction + options.length) % options.length;
    onChange(options[next]!.value);
    listRef.current?.querySelector<HTMLElement>(`[data-option-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, onChange, options]);
  const listboxId = id ? `${id}-listbox` : undefined;

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => { selectedValueRef.current = value; disabledRef.current = disabled; }, [value, disabled]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (selectedValueRef.current !== selectedOption?.value || disabledRef.current || (!buttonRef.current?.contains(target) && !listRef.current?.contains(target))) close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowDown") moveActive(1);
      if (event.key === "ArrowUp") moveActive(-1);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, moveActive, selectedOption?.value, value, disabled]);

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        data-value={value}
        onClick={toggle}
        className={`min-h-11 w-full min-w-0 rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? "border-primary" : ""}`}
      >
        <span className={`min-w-0 flex-1 text-left [overflow-wrap:anywhere] ${value ? "text-text" : "text-text-muted"}`}>{value ? selectedOption?.label ?? placeholder : placeholder}</span>
        <svg
          className={`ml-2 h-4 w-4 text-text-muted flex-shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); } if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); } }}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-card border border-border bg-surface py-1 shadow-lg"
        >
          <li role="option" aria-selected={!value} onClick={() => { onChange(""); close(); }} className={`px-3 py-2 text-base [overflow-wrap:anywhere] cursor-pointer ${!value ? "bg-primary text-primary-fixed" : "text-text hover:bg-canvas"}`}>
            {placeholder}
          </li>
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-option-index={options.indexOf(option)}
              onClick={() => { onChange(option.value); close(); }}
              className={`px-3 py-2 text-base [overflow-wrap:anywhere] cursor-pointer ${option.value === value ? "bg-primary text-primary-fixed" : "text-text hover:bg-canvas"}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}