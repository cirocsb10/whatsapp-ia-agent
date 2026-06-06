export type BusinessHoursDay = { enabled: boolean; start: string; end: string };
export type BusinessHoursMap = Record<string, BusinessHoursDay>;

export const DAYS: { key: string; label: string }[] = [
  { key: "monday",    label: "Segunda" },
  { key: "tuesday",   label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday",  label: "Quinta" },
  { key: "friday",    label: "Sexta" },
  { key: "saturday",  label: "Sábado" },
  { key: "sunday",    label: "Domingo" },
];

export const DEFAULT_BUSINESS_HOURS: BusinessHoursMap = Object.fromEntries(
  DAYS.map(({ key }) => [
    key,
    { enabled: key !== "saturday" && key !== "sunday", start: "09:00", end: "18:00" },
  ])
);

export function normalizeBusinessHours(raw: unknown): BusinessHoursMap {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return DEFAULT_BUSINESS_HOURS;
  }
  return Object.fromEntries(
    DAYS.map(({ key }) => {
      const entry = (raw as Record<string, unknown>)[key];
      if (typeof entry === "object" && entry !== null) {
        const e = entry as Partial<BusinessHoursDay>;
        return [key, {
          enabled: e.enabled ?? (key !== "saturday" && key !== "sunday"),
          start: e.start ?? "09:00",
          end: e.end ?? "18:00",
        }];
      }
      return [key, { enabled: key !== "saturday" && key !== "sunday", start: "09:00", end: "18:00" }];
    })
  );
}

export function tempLabel(value: number): string {
  if (value <= 0.3) return "Preciso";
  if (value <= 0.7) return "Equilibrado";
  return "Criativo";
}
