"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "Início", path: "/setup" },
  { id: 2, label: "Empresa", path: "/setup/company" },
  { id: 3, label: "WhatsApp", path: "/setup/whatsapp" },
  { id: 4, label: "Produtos", path: "/setup/products" },
  { id: 5, label: "Plano", path: "/setup/plan" },
];

function getActiveStep(pathname: string) {
  if (pathname.startsWith("/setup/plan")) return 5;
  if (pathname.startsWith("/setup/products")) return 4;
  if (pathname.startsWith("/setup/whatsapp")) return 3;
  if (pathname.startsWith("/setup/company")) return 2;
  if (pathname.startsWith("/setup")) return 1;
  return 1;
}

export function OnboardingStepper() {
  const pathname = usePathname();
  const active = getActiveStep(pathname);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {STEPS.map((s, i) => {
        const isDone = s.id < active;
        const isCurrent = s.id === active;

        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  transition: "all 180ms ease",
                  ...(isCurrent
                    ? {
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.4)",
                        color: "#a5b4fc",
                        boxShadow: "0 0 12px rgba(99,102,241,0.2)",
                      }
                    : isDone
                      ? {
                          background: "rgba(34,197,94,0.12)",
                          border: "1px solid rgba(34,197,94,0.3)",
                          color: "#4ade80",
                        }
                      : {
                          background: "#0c1526",
                          border: "1px solid #1a2d47",
                          color: "#64748b",
                        }),
                }}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? <Check style={{ width: 11, height: 11 }} /> : s.id}
              </div>
              <span
                className="hidden md:inline"
                style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? "#c7d2fe" : isDone ? "#64748b" : "#475569",
                  transition: "color 180ms ease",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 20,
                  height: 1,
                  margin: "0 5px",
                  background: isDone ? "rgba(34,197,94,0.3)" : "#1a2d47",
                  transition: "background 180ms ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
