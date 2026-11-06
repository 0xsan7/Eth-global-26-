import { describe, expect, it } from "vitest";
import { keccak256, stringToHex } from "viem";
import { getPublicConfig, validatePublicConfig } from "../../src/lib/shared/deployment";
import { developmentJob } from "../../src/lib/shared/fixtures";

describe("public deployment configuration", () => {
  it("is honestly unconfigured before deployment", () => {
    const config = getPublicConfig();
    expect(config.configured).toBe(false);
    expect(config.terms).toBeNull();
  });
  it("rejects enabling checkout without complete terms", () => {
    expect(() => validatePublicConfig({ ...getPublicConfig(), configured: true })).toThrow();
  });
  it("binds displayed terms and fixed price to the deployment record", () => {
    const config = getPublicConfig();
    const terms = { ...developmentJob().terms, termsHash: keccak256(stringToHex(config.serviceTermsText)) };
    expect(validatePublicConfig({ ...config, configured: true, terms }).configured).toBe(true);
    expect(() => validatePublicConfig({ ...config, configured: true, terms: { ...terms, amountAtomic: "2" } })).toThrow();
    expect(() => validatePublicConfig({ ...config, configured: true, terms, serviceTermsText: "Different terms" })).toThrow();
  });
});
