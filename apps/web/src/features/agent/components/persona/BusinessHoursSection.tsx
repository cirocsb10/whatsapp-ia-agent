"use client";
import { Clock } from "lucide-react";
import { TimeInput } from "@/components/ui/TimeInput";
import { DAYS } from "@/lib/persona";
import type { FormState, PatchFn } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  patch: PatchFn;
  loading: boolean;
}

export function BusinessHoursSection({ form, patch, loading }: Props) {
  return (
    <section className="persona-card">
      <div className="persona-card-head">
        <div className="persona-card-icon persona-card-icon--cyan">
          <Clock className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="persona-card-title">Horário de Funcionamento</p>
          <p className="persona-card-sub">Define quando o agente responde automaticamente</p>
        </div>
      </div>

      <div className="persona-card-body persona-card-body--stack">
        <div className="persona-hours-list">
          {DAYS.map(({ key, label }) => {
            const day = form.businessHours[key] ?? { enabled: false, start: "09:00", end: "18:00" };
            return (
              <div
                key={key}
                className={`persona-hours-row${day.enabled ? " persona-hours-row--on" : ""}`}
              >
                <div className="persona-hours-day-col">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.enabled}
                    aria-label={`${day.enabled ? "Desativar" : "Ativar"} ${label}`}
                    disabled={loading}
                    className={`persona-hours-switch${day.enabled ? " persona-hours-switch--on" : ""}`}
                    onClick={() =>
                      patch("businessHours", {
                        ...form.businessHours,
                        [key]: { ...day, enabled: !day.enabled },
                      })
                    }
                  >
                    <span className="persona-hours-switch-thumb" />
                  </button>
                  <span className={`persona-hours-day${day.enabled ? "" : " persona-hours-day--off"}`}>
                    {label}
                  </span>
                </div>
                <div className="persona-hours-times">
                  <TimeInput
                    value={day.start}
                    onChange={(start) =>
                      patch("businessHours", {
                        ...form.businessHours,
                        [key]: { ...day, start },
                      })
                    }
                    disabled={loading || !day.enabled}
                  />
                  <span className="persona-hours-sep" aria-hidden>
                    até
                  </span>
                  <TimeInput
                    value={day.end}
                    onChange={(end) =>
                      patch("businessHours", {
                        ...form.businessHours,
                        [key]: { ...day, end },
                      })
                    }
                    disabled={loading || !day.enabled}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
