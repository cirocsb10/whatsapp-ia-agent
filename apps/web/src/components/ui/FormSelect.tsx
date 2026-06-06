"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function FormSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Selecionar…",
  id,
}: FormSelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectOption(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("form-select", open && "form-select--open")}>
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        className="form-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="form-select-value">
          {selected ? (
            <>
              {selected.color && (
                <span
                  className="form-select-dot"
                  style={{ background: selected.color }}
                  aria-hidden
                />
              )}
              {selected.label}
            </>
          ) : (
            <span className="form-select-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="form-select-chevron" strokeWidth={2} />
      </button>

      {open && (
        <ul className="form-select-menu" role="listbox" aria-labelledby={selectId}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn("form-select-option", active && "form-select-option--active")}
                  onClick={() => selectOption(opt.value)}
                >
                  <span className="form-select-option-label">
                    {opt.color && (
                      <span
                        className="form-select-dot"
                        style={{ background: opt.color }}
                        aria-hidden
                      />
                    )}
                    {opt.label}
                  </span>
                  {active && <Check className="form-select-check" strokeWidth={2.5} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
