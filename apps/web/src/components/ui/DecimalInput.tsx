"use client";

import { cn } from "@/lib/utils";
import { maskDecimalInput } from "@/lib/decimal-mask";

interface DecimalInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DecimalInput({
  value,
  onChange,
  className,
  id,
  placeholder = "0,00",
  required,
  disabled,
}: DecimalInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn("form-input", className)}
      value={value}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      onChange={(e) => onChange(maskDecimalInput(e.target.value))}
    />
  );
}
