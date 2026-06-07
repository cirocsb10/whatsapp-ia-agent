"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MENU_HEIGHT = 184;

function minuteOptions(current: string): string[] {
  const set = new Set(
    Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")),
  );
  if (/^\d{2}$/.test(current)) set.add(current);
  return [...set].sort();
}

function parseTime(value: string): [string, string] {
  const [h = "09", m = "00"] = (value || "09:00").split(":");
  return [h.padStart(2, "0"), m.padStart(2, "0")];
}

function getMenuPosition(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < MENU_HEIGHT && rect.top > MENU_HEIGHT;

  return {
    left: rect.left + rect.width / 2,
    top: openUp ? rect.top - 6 : rect.bottom + 6,
    transform: openUp ? "translate(-50%, -100%)" : "translateX(-50%)",
  };
}

function scrollColumnToActive(col: HTMLDivElement | null) {
  const active = col?.querySelector(".form-time-option--active") as HTMLElement | null;
  if (!col || !active) return;
  col.scrollTop = active.offsetTop - col.clientHeight / 2 + active.clientHeight / 2;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function TimeInput({ value, onChange, disabled = false, id }: TimeInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const [hour, minute] = parseTime(value);
  const minutes = useMemo(() => minuteOptions(minute), [minute]);

  const syncMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setMenuStyle(getMenuPosition(trigger));
  };

  useLayoutEffect(() => {
    if (!open) return;

    syncMenuPosition();
    scrollColumnToActive(hourColRef.current);
    scrollColumnToActive(minuteColRef.current);

    window.addEventListener("scroll", syncMenuPosition, true);
    window.addEventListener("resize", syncMenuPosition);
    return () => {
      window.removeEventListener("scroll", syncMenuPosition, true);
      window.removeEventListener("resize", syncMenuPosition);
    };
  }, [open, hour, minute]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setMenuStyle(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuStyle(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleToggle() {
    if (disabled) return;

    if (open) {
      setOpen(false);
      setMenuStyle(null);
      return;
    }

    const trigger = triggerRef.current;
    if (trigger) setMenuStyle(getMenuPosition(trigger));
    setOpen(true);
  }

  function setTime(nextHour: string, nextMinute: string) {
    onChange(`${nextHour}:${nextMinute}`);
  }

  const menu =
    open &&
    menuStyle &&
    createPortal(
      <div className="form-time-menu-anchor" style={menuStyle}>
        <div
          ref={menuRef}
          className="form-time-menu"
          role="listbox"
          aria-labelledby={inputId}
        >
          <div className="form-time-columns">
            <div className="form-time-col" ref={hourColRef}>
              <span className="form-time-col-label">Hora</span>
              {HOURS.map((h) => {
                const active = h === hour;
                return (
                  <button
                    key={h}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn("form-time-option", active && "form-time-option--active")}
                    onClick={() => setTime(h, minute)}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="form-time-col-divider" aria-hidden />
            <div className="form-time-col" ref={minuteColRef}>
              <span className="form-time-col-label">Min</span>
              {minutes.map((m) => {
                const active = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn("form-time-option", active && "form-time-option--active")}
                    onClick={() => {
                      setTime(hour, m);
                      setOpen(false);
                      setMenuStyle(null);
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className={cn("form-time", open && "form-time--open")}>
      <button
        id={inputId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className="form-time-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <Clock className="form-time-icon" strokeWidth={2} aria-hidden />
        <span className="form-time-value">
          {hour}:{minute}
        </span>
      </button>
      {menu}
    </div>
  );
}
