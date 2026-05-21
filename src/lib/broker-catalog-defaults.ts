/**
 * Default rows for `admin_broker_catalog` (seed when empty + upsert missing slugs).
 * Import UI shows all catalog brokers; CSV ingest remains Merrill/Fidelity only until parsers ship.
 */
export type BrokerCatalogDefaultEntry = {
  type: string;
  name: string;
  description: string;
  iconUrl: string;
};

export const DEFAULT_BROKER_CATALOG_ENTRIES: readonly BrokerCatalogDefaultEntry[] = [
  {
    type: "merrill",
    name: "Merrill Edge",
    description:
      "Bank of America Merrill Edge — typical CSV exports for positions and activity (admin + broker import defaults).",
    iconUrl: "/brokers/merrill-edge.png"
  },
  {
    type: "fidelity",
    name: "Fidelity",
    description: "Fidelity Investments — common retail brokerage CSV layouts for holdings.",
    iconUrl: "/brokers/fidelity.png"
  },
  {
    type: "etrade",
    name: "E*TRADE",
    description: "E*TRADE from Morgan Stanley — CSV holdings and history exports (import TBD).",
    iconUrl: "/brokers/etrade.png"
  },
  {
    type: "ibkr",
    name: "Interactive Brokers (IBKR)",
    description:
      "Interactive Brokers (IBKR) — multi-asset brokerage; Client Portal snapshots where enabled, CSV import TBD.",
    iconUrl: "/brokers/ibkr.png"
  },
  {
    type: "forge",
    name: "Forge Global",
    description:
      "Forge Global — private market shares and Forge Price™ for pre-IPO companies (CSV import TBD).",
    iconUrl: ""
  },
  {
    type: "hiive",
    name: "Hiive",
    description: "Hiive — marketplace for buying and selling pre-IPO stock (CSV import TBD).",
    iconUrl: ""
  }
] as const;

export const BROKER_CATALOG_CSV_IMPORT_READY_TYPES = new Set(["merrill", "fidelity"]);

export const BROKER_CATALOG_COMING_SOON_LABEL =
  "Merrill Edge and Fidelity support CSV import today. Interactive Brokers (IBKR), E*TRADE, Forge Global, and Hiive are on the roadmap.";
