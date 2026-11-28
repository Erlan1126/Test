import { describe, expect, it, vi } from "vitest";

describe("store product ids, Buildaroo (full edition)", () => {
  it("uses the plain ids on both stores and keeps Buildaroo's App Store VIP id", async () => {
    vi.resetModules();
    const m = await import("../src/data/storeids");
    expect(m.packStoreId("crystals_200", true)).toBe("crystals_200");
    expect(m.packStoreId("crystals_200", false)).toBe("crystals_200");
    expect(m.vipStoreId(true)).toBe("skyrise_vip_monthly");
    expect(m.vipStoreId(false)).toBe("vip_monthly");
    expect(m.ourId("crystals_200", true)).toBe("crystals_200");
  });
});

describe("store product ids, Skyrise edition", () => {
  it("asks the App Store for skyrise.-prefixed ids and maps them back", async () => {
    vi.resetModules();
    vi.doMock("../src/edition", async orig => ({ ...(await orig<typeof import("../src/edition")>()), EDITION: "skyrise", HAS_CITY: false }));
    const m = await import("../src/data/storeids");
    expect(m.packStoreId("crystals_200", true)).toBe("skyrise.crystals_200");
    expect(m.packStoreId("starter_pack", true)).toBe("skyrise.starter_pack");
    expect(m.ourId("skyrise.crystals_200", true)).toBe("crystals_200");
    expect(m.vipStoreId(true)).toBe("skyrise.vip_monthly");
    expect(m.ourId(m.vipStoreId(true), true)).toBe("vip_monthly");
    // Google Play ids are per app: plain ids.
    expect(m.packStoreId("crystals_200", false)).toBe("crystals_200");
    expect(m.vipStoreId(false)).toBe("vip_monthly");
    vi.doUnmock("../src/edition");
  });
});
