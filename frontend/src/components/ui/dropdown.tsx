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
  const listboxId = id ? `${id}-listbox` : undefined;

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

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
        className={`min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? "border-primary" : ""}`}
      >
        <span className={value ? "text-text" : "text-text-muted"}>{value ? selectedOption?.label ?? placeholder : placeholder}</span>
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
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-card border border-border bg-surface shadow-lg py-1"
        >
          <li role="option" aria-selected={!value} onClick={() => { onChange(""); close(); }} className={`px-3 py-2 text-base cursor-pointer ${!value ? "bg-primary text-primary-fixed" : "text-text hover:bg-canvas"}`}>
            {placeholder}
          </li>
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => { onChange(option.value); close(); }}
              className={`px-3 py-2 text-base cursor-pointer ${option.value === value ? "bg-primary text-primary-fixed" : "text-text hover:bg-canvas"}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}