import { isGoogleAuthConfigured } from "./google-client";

describe("isGoogleAuthConfigured", () => {
  it("returns false when unset or blank", () => {
    expect(isGoogleAuthConfigured(undefined)).toBe(false);
    expect(isGoogleAuthConfigured("")).toBe(false);
    expect(isGoogleAuthConfigured("   ")).toBe(false);
  });

  it("returns true when client id is set", () => {
    expect(isGoogleAuthConfigured("123-abc.apps.googleusercontent.com")).toBe(true);
  });
});
