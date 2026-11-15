import { describe, expect, it } from "vitest";
import { getVersionProfile, VERSION_PROFILES } from "../src/constants.js";

describe("HarmonyOS version profiles", () => {
  it("covers the complete HarmonyOS 6 release family", () => {
    expect(VERSION_PROFILES["6"].apiMin).toBe(20);
    expect(VERSION_PROFILES["6"].apiMax).toBe(24);
    expect(VERSION_PROFILES["6"].releases.at(-1)).toEqual({
      name: "HarmonyOS 6.1.1",
      api: 24
    });
  });

  it("resolves the exact HarmonyOS 6.1.1 device profile", () => {
    expect(getVersionProfile("HarmonyOS 6.1.1")).toMatchObject({
      id: "6.1.1",
      apiMin: 24,
      apiMax: 24
    });
    expect(getVersionProfile("6.1")).toMatchObject({
      apiMin: 23,
      apiMax: 24
    });
  });
});
