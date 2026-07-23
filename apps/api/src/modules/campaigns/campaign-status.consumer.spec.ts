import { toCampaignStatusUpdateInput } from "./campaign-status.consumer";

describe("toCampaignStatusUpdateInput", () => {
  it("omite failureReason quando ausente (exactOptionalPropertyTypes)", () => {
    const input = toCampaignStatusUpdateInput({
      tenantId: "t1",
      waMessageId: "wamid.1",
      status: "delivered",
      timestamp: 1700000000,
    });

    expect(input).toEqual({
      tenantId: "t1",
      waMessageId: "wamid.1",
      status: "delivered",
      timestamp: 1700000000,
    });
    expect(Object.prototype.hasOwnProperty.call(input, "failureReason")).toBe(false);
  });

  it("inclui failureReason quando definido", () => {
    const input = toCampaignStatusUpdateInput({
      tenantId: "t1",
      waMessageId: "wamid.1",
      status: "failed",
      timestamp: 1700000001,
      failureReason: "undeliverable",
    });

    expect(input.failureReason).toBe("undeliverable");
  });
});
