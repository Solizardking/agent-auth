import { describe, expect, it } from "vitest";
import { createCaapHash, verifyCaapAttestation } from "../verify";

describe("verifyCaapAttestation (shipped API)", () => {
  it("accepts a valid SHA-256 hex hash with required fields", () => {
    const hash = createCaapHash(
      "agent-1",
      "Wallet1111111111111111111111111111111",
      "Mint11111111111111111111111111111111",
      1_700_000_000_000,
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      verifyCaapAttestation(
        hash,
        "agent-1",
        "Wallet1111111111111111111111111111111",
        "Mint11111111111111111111111111111111",
      ),
    ).toBe(true);
  });

  it("rejects non-hex or wrong-length hashes", () => {
    expect(
      verifyCaapAttestation(
        "not-a-hash",
        "agent-1",
        "wallet",
        "mint",
      ),
    ).toBe(false);
    expect(
      verifyCaapAttestation(
        "abcd",
        "agent-1",
        "wallet",
        "mint",
      ),
    ).toBe(false);
  });

  it("rejects empty required fields", () => {
    const hash = createCaapHash("a", "w", "m", 1);
    expect(verifyCaapAttestation(hash, "", "w", "m")).toBe(false);
    expect(verifyCaapAttestation(hash, "a", "", "m")).toBe(false);
    expect(verifyCaapAttestation(hash, "a", "w", "")).toBe(false);
  });
});
