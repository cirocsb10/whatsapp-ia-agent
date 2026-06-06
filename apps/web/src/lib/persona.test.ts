import {
  DAYS,
  DEFAULT_BUSINESS_HOURS,
  normalizeBusinessHours,
  tempLabel,
  type BusinessHoursDay,
} from "./persona";

// ── tempLabel ──────────────────────────────────────────────────────────────

describe("tempLabel", () => {
  it('returns "Preciso" at 0.0', () => {
    expect(tempLabel(0.0)).toBe("Preciso");
  });

  it('returns "Preciso" at 0.3 (upper boundary of precise range)', () => {
    expect(tempLabel(0.3)).toBe("Preciso");
  });

  it('returns "Equilibrado" just above 0.3', () => {
    expect(tempLabel(0.31)).toBe("Equilibrado");
  });

  it('returns "Equilibrado" at 0.7 (upper boundary)', () => {
    expect(tempLabel(0.7)).toBe("Equilibrado");
  });

  it('returns "Criativo" just above 0.7', () => {
    expect(tempLabel(0.71)).toBe("Criativo");
  });

  it('returns "Criativo" at 2.0 (max slider value)', () => {
    expect(tempLabel(2.0)).toBe("Criativo");
  });
});

// ── DEFAULT_BUSINESS_HOURS ────────────────────────────────────────────────

describe("DEFAULT_BUSINESS_HOURS", () => {
  it("covers all 7 days", () => {
    const keys = DAYS.map((d) => d.key);
    expect(Object.keys(DEFAULT_BUSINESS_HOURS).sort()).toEqual(keys.sort());
  });

  it("enables weekdays (Mon–Fri) by default", () => {
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    weekdays.forEach((day) => {
      expect(DEFAULT_BUSINESS_HOURS[day].enabled).toBe(true);
    });
  });

  it("disables Saturday and Sunday by default", () => {
    expect(DEFAULT_BUSINESS_HOURS["saturday"].enabled).toBe(false);
    expect(DEFAULT_BUSINESS_HOURS["sunday"].enabled).toBe(false);
  });

  it("sets 09:00–18:00 as the default time range for every day", () => {
    DAYS.forEach(({ key }) => {
      expect(DEFAULT_BUSINESS_HOURS[key].start).toBe("09:00");
      expect(DEFAULT_BUSINESS_HOURS[key].end).toBe("18:00");
    });
  });
});

// ── normalizeBusinessHours ────────────────────────────────────────────────

describe("normalizeBusinessHours", () => {
  describe("invalid inputs → returns DEFAULT_BUSINESS_HOURS", () => {
    it("handles null", () => {
      expect(normalizeBusinessHours(null)).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("handles undefined", () => {
      expect(normalizeBusinessHours(undefined)).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("handles empty string", () => {
      expect(normalizeBusinessHours("")).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("handles non-empty string", () => {
      expect(normalizeBusinessHours("invalid")).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("handles number", () => {
      expect(normalizeBusinessHours(42)).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("handles array (not a plain object)", () => {
      expect(normalizeBusinessHours([])).toEqual(DEFAULT_BUSINESS_HOURS);
    });
  });

  describe("empty object {} → weekday defaults", () => {
    it("returns all 7 days when given empty object", () => {
      const result = normalizeBusinessHours({});
      expect(Object.keys(result)).toHaveLength(7);
    });

    it("enables weekdays when key is missing from empty object", () => {
      const result = normalizeBusinessHours({});
      expect(result["monday"].enabled).toBe(true);
      expect(result["friday"].enabled).toBe(true);
    });

    it("disables weekend when key is missing from empty object", () => {
      const result = normalizeBusinessHours({});
      expect(result["saturday"].enabled).toBe(false);
      expect(result["sunday"].enabled).toBe(false);
    });

    it("uses 09:00–18:00 defaults when key is missing", () => {
      const result = normalizeBusinessHours({});
      expect(result["monday"].start).toBe("09:00");
      expect(result["monday"].end).toBe("18:00");
    });
  });

  describe("valid full schedule → preserves provided values", () => {
    const schedule: Record<string, BusinessHoursDay> = {
      monday:    { enabled: true,  start: "08:00", end: "17:00" },
      tuesday:   { enabled: true,  start: "08:00", end: "17:00" },
      wednesday: { enabled: false, start: "09:00", end: "18:00" },
      thursday:  { enabled: true,  start: "08:00", end: "17:00" },
      friday:    { enabled: true,  start: "08:00", end: "13:00" },
      saturday:  { enabled: true,  start: "09:00", end: "12:00" },
      sunday:    { enabled: false, start: "09:00", end: "12:00" },
    };

    it("preserves enabled=true for a weekday", () => {
      expect(normalizeBusinessHours(schedule)["monday"].enabled).toBe(true);
    });

    it("preserves enabled=false for a weekday", () => {
      expect(normalizeBusinessHours(schedule)["wednesday"].enabled).toBe(false);
    });

    it("preserves enabled=true for Saturday", () => {
      expect(normalizeBusinessHours(schedule)["saturday"].enabled).toBe(true);
    });

    it("preserves custom start time", () => {
      expect(normalizeBusinessHours(schedule)["monday"].start).toBe("08:00");
    });

    it("preserves custom end time", () => {
      expect(normalizeBusinessHours(schedule)["friday"].end).toBe("13:00");
    });
  });

  describe("partial schedule → merges with defaults for missing keys", () => {
    it("fills in missing days with defaults", () => {
      const partial = {
        monday: { enabled: true, start: "07:00", end: "15:00" },
      };
      const result = normalizeBusinessHours(partial);
      expect(Object.keys(result)).toHaveLength(7);
      expect(result["monday"].start).toBe("07:00");
      expect(result["tuesday"].start).toBe("09:00");
    });

    it("fills missing enabled field for weekday with true", () => {
      const partial = {
        monday: { start: "09:00", end: "18:00" }, // enabled missing
      };
      const result = normalizeBusinessHours(partial);
      expect(result["monday"].enabled).toBe(true);
    });

    it("fills missing enabled field for Saturday with false", () => {
      const partial = {
        saturday: { start: "10:00", end: "14:00" }, // enabled missing
      };
      const result = normalizeBusinessHours(partial);
      expect(result["saturday"].enabled).toBe(false);
    });

    it("fills missing start with 09:00", () => {
      const partial = {
        monday: { enabled: true, end: "18:00" }, // start missing
      };
      expect(normalizeBusinessHours(partial)["monday"].start).toBe("09:00");
    });

    it("fills missing end with 18:00", () => {
      const partial = {
        monday: { enabled: true, start: "09:00" }, // end missing
      };
      expect(normalizeBusinessHours(partial)["monday"].end).toBe("18:00");
    });
  });

  describe("malformed day entries → falls back to day defaults", () => {
    it("replaces a string day entry with defaults", () => {
      const raw = { monday: "invalid" };
      const result = normalizeBusinessHours(raw);
      expect(result["monday"].enabled).toBe(true);
      expect(result["monday"].start).toBe("09:00");
    });

    it("replaces a number day entry with defaults", () => {
      const raw = { saturday: 0 };
      const result = normalizeBusinessHours(raw);
      expect(result["saturday"].enabled).toBe(false);
    });

    it("replaces a null day entry with defaults", () => {
      const raw = { friday: null };
      const result = normalizeBusinessHours(raw);
      expect(result["friday"].enabled).toBe(true);
    });
  });
});
