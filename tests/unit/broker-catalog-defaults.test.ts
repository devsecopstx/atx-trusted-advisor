import { describe, expect, it } from "vitest";

import {
    BROKER_CATALOG_COMING_SOON_LABEL,
    BROKER_CATALOG_CSV_IMPORT_READY_TYPES,
    DEFAULT_BROKER_CATALOG_ENTRIES
} from "@/lib/broker-catalog-defaults";

describe("broker-catalog-defaults", () => {
  it("includes Forge Global and Hiive placeholders", () => {
    const types = DEFAULT_BROKER_CATALOG_ENTRIES.map((e) => e.type);
    expect(types).toContain("forge");
    expect(types).toContain("hiive");
    const forge = DEFAULT_BROKER_CATALOG_ENTRIES.find((e) => e.type === "forge");
    const hiive = DEFAULT_BROKER_CATALOG_ENTRIES.find((e) => e.type === "hiive");
    expect(forge?.name).toBe("Forge Global");
    expect(hiive?.name).toBe("Hiive");
    expect(forge?.description.toLowerCase()).toContain("pre-ipo");
    expect(hiive?.description.toLowerCase()).toContain("pre-ipo");
  });

  it("limits CSV-ready brokers to Merrill and Fidelity", () => {
    expect([...BROKER_CATALOG_CSV_IMPORT_READY_TYPES].sort()).toEqual(["fidelity", "merrill"]);
  });

  it("roadmap label mentions Forge and Hiive", () => {
    expect(BROKER_CATALOG_COMING_SOON_LABEL.toLowerCase()).toContain("forge");
    expect(BROKER_CATALOG_COMING_SOON_LABEL.toLowerCase()).toContain("hiive");
    expect(BROKER_CATALOG_COMING_SOON_LABEL.toLowerCase()).toContain("ibkr");
  });
});
