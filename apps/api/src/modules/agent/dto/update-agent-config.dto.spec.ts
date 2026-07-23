import "reflect-metadata";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateAgentConfigDto } from "./update-agent-config.dto";

function dto(plain: Record<string, unknown>) {
  return plainToInstance(UpdateAgentConfigDto, plain);
}

async function errors(plain: Record<string, unknown>) {
  const instance = dto(plain);
  return validate(instance);
}

describe("UpdateAgentConfigDto", () => {
  describe("existing fields (regression)", () => {
    it("accepts empty object — all fields are optional", async () => {
      expect(await errors({})).toHaveLength(0);
    });

    it("rejects agentName longer than 80 chars", async () => {
      const violations = await errors({ agentName: "a".repeat(81) });
      expect(violations.some((v) => v.property === "agentName")).toBe(true);
    });

    it("rejects llmTemperature above 2", async () => {
      const violations = await errors({ llmTemperature: 2.1 });
      expect(violations.some((v) => v.property === "llmTemperature")).toBe(true);
    });
  });

  describe("outOfHoursMessage", () => {
    it("accepts valid string", async () => {
      expect(await errors({ outOfHoursMessage: "Estamos fechados." })).toHaveLength(0);
    });

    it("rejects string longer than 500 chars", async () => {
      const violations = await errors({ outOfHoursMessage: "x".repeat(501) });
      expect(violations.some((v) => v.property === "outOfHoursMessage")).toBe(true);
    });

    it("rejects non-string value", async () => {
      const violations = await errors({ outOfHoursMessage: 42 });
      expect(violations.some((v) => v.property === "outOfHoursMessage")).toBe(true);
    });
  });

  describe("handoffMessage", () => {
    it("accepts valid string", async () => {
      expect(await errors({ handoffMessage: "Transferindo você…" })).toHaveLength(0);
    });

    it("rejects string longer than 500 chars", async () => {
      const violations = await errors({ handoffMessage: "h".repeat(501) });
      expect(violations.some((v) => v.property === "handoffMessage")).toBe(true);
    });
  });

  describe("autoHandoffThreshold", () => {
    it("accepts 0.0 (lower boundary)", async () => {
      expect(await errors({ autoHandoffThreshold: 0 })).toHaveLength(0);
    });

    it("accepts 1.0 (upper boundary)", async () => {
      expect(await errors({ autoHandoffThreshold: 1 })).toHaveLength(0);
    });

    it("accepts midpoint 0.3", async () => {
      expect(await errors({ autoHandoffThreshold: 0.3 })).toHaveLength(0);
    });

    it("rejects value above 1", async () => {
      const violations = await errors({ autoHandoffThreshold: 1.01 });
      expect(violations.some((v) => v.property === "autoHandoffThreshold")).toBe(true);
    });

    it("rejects negative value", async () => {
      const violations = await errors({ autoHandoffThreshold: -0.1 });
      expect(violations.some((v) => v.property === "autoHandoffThreshold")).toBe(true);
    });
  });

  describe("handoffOrderValueBrl", () => {
    it("accepts positive number", async () => {
      expect(await errors({ handoffOrderValueBrl: 500 })).toHaveLength(0);
    });

    it("accepts null (nullable)", async () => {
      expect(await errors({ handoffOrderValueBrl: null })).toHaveLength(0);
    });

    it("accepts undefined (optional)", async () => {
      expect(await errors({})).toHaveLength(0);
    });

    it("rejects negative value", async () => {
      const violations = await errors({ handoffOrderValueBrl: -1 });
      expect(violations.some((v) => v.property === "handoffOrderValueBrl")).toBe(true);
    });
  });

  describe("inactivityTimeoutMin", () => {
    it("accepts valid value within range", async () => {
      expect(await errors({ inactivityTimeoutMin: 30 })).toHaveLength(0);
    });

    it("accepts lower boundary (5)", async () => {
      expect(await errors({ inactivityTimeoutMin: 5 })).toHaveLength(0);
    });

    it("accepts upper boundary (1440)", async () => {
      expect(await errors({ inactivityTimeoutMin: 1440 })).toHaveLength(0);
    });

    it("rejects value below minimum (4)", async () => {
      const violations = await errors({ inactivityTimeoutMin: 4 });
      expect(violations.some((v) => v.property === "inactivityTimeoutMin")).toBe(true);
    });

    it("rejects value above maximum (1441)", async () => {
      const violations = await errors({ inactivityTimeoutMin: 1441 });
      expect(violations.some((v) => v.property === "inactivityTimeoutMin")).toBe(true);
    });

    it("rejects float (must be integer)", async () => {
      const violations = await errors({ inactivityTimeoutMin: 30.5 });
      expect(violations.some((v) => v.property === "inactivityTimeoutMin")).toBe(true);
    });
  });

  describe("sessionTtlHours", () => {
    it("accepts valid value within range", async () => {
      expect(await errors({ sessionTtlHours: 24 })).toHaveLength(0);
    });

    it("accepts lower boundary (1)", async () => {
      expect(await errors({ sessionTtlHours: 1 })).toHaveLength(0);
    });

    it("accepts upper boundary (720)", async () => {
      expect(await errors({ sessionTtlHours: 720 })).toHaveLength(0);
    });

    it("rejects zero (below minimum)", async () => {
      const violations = await errors({ sessionTtlHours: 0 });
      expect(violations.some((v) => v.property === "sessionTtlHours")).toBe(true);
    });

    it("rejects value above maximum (721)", async () => {
      const violations = await errors({ sessionTtlHours: 721 });
      expect(violations.some((v) => v.property === "sessionTtlHours")).toBe(true);
    });
  });

  describe("maxConversationLength", () => {
    it("accepts valid value within range", async () => {
      expect(await errors({ maxConversationLength: 50 })).toHaveLength(0);
    });

    it("accepts lower boundary (5)", async () => {
      expect(await errors({ maxConversationLength: 5 })).toHaveLength(0);
    });

    it("accepts upper boundary (500)", async () => {
      expect(await errors({ maxConversationLength: 500 })).toHaveLength(0);
    });

    it("rejects value below minimum (4)", async () => {
      const violations = await errors({ maxConversationLength: 4 });
      expect(violations.some((v) => v.property === "maxConversationLength")).toBe(true);
    });

    it("rejects value above maximum (501)", async () => {
      const violations = await errors({ maxConversationLength: 501 });
      expect(violations.some((v) => v.property === "maxConversationLength")).toBe(true);
    });
  });

  describe("businessHours", () => {
    it("accepts valid weekly schedule object", async () => {
      const bh = {
        monday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: false, start: "09:00", end: "12:00" },
      };
      expect(await errors({ businessHours: bh })).toHaveLength(0);
    });

    it("accepts empty object", async () => {
      expect(await errors({ businessHours: {} })).toHaveLength(0);
    });

    it("rejects a string (not an object)", async () => {
      const violations = await errors({ businessHours: "invalid" });
      expect(violations.some((v) => v.property === "businessHours")).toBe(true);
    });

    it("rejects an array (IsObject rejects arrays)", async () => {
      const violations = await errors({ businessHours: [] });
      expect(violations.some((v) => v.property === "businessHours")).toBe(true);
    });
  });

  describe("crmProgressionEnabled", () => {
    it("accepts boolean true", async () => {
      expect(await errors({ crmProgressionEnabled: true })).toHaveLength(0);
    });

    it("accepts boolean false", async () => {
      expect(await errors({ crmProgressionEnabled: false })).toHaveLength(0);
    });

    it("rejects non-boolean value", async () => {
      const violations = await errors({ crmProgressionEnabled: "yes" });
      expect(violations.some((v) => v.property === "crmProgressionEnabled")).toBe(true);
    });
  });

  describe("full valid payload", () => {
    it("accepts all new fields together with no violations", async () => {
      const violations = await errors({
        outOfHoursMessage: "Fechados agora.",
        handoffMessage: "Transferindo…",
        autoHandoffThreshold: 0.4,
        handoffOrderValueBrl: 299.9,
        inactivityTimeoutMin: 15,
        sessionTtlHours: 48,
        maxConversationLength: 100,
        businessHours: {
          monday: { enabled: true, start: "08:00", end: "17:00" },
          sunday: { enabled: false, start: "09:00", end: "12:00" },
        },
      });
      expect(violations).toHaveLength(0);
    });
  });
});
