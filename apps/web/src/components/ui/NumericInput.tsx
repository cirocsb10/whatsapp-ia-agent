"use client";

import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function NumericInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  required,
  disabled,
}: NumericInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={cn("form-input", className)}
      value={value}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "" || /^\d+$/.test(raw)) onChange(raw);
      }}
    />
  );
}
