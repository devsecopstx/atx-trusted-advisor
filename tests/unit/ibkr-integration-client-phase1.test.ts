import { describe, expect, it } from "vitest";

import { createIbkrClientPhase1 } from "@/modules/ibkr-integration/client-phase1";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";

describe("createIbkrClientPhase1", () => {
  it("returns phase-1 stub: no live API, flags reflect config", () => {
    const client = createIbkrClientPhase1(
      parseIbkrIntegrationConfig({
        ...process.env,
        IBKR_ENABLED: "1",
        IBKR_PAPER: "true"
      })
    );
    expect(client.phase).toBe(1);
    expect(client.enabled).toBe(true);
    expect(client.paperTrading).toBe(true);
    expect(client.apiReachable).toBe(false);
  });

  it("disabled when config.enabled is false", () => {
    const client = createIbkrClientPhase1(parseIbkrIntegrationConfig({}));
    expect(client.enabled).toBe(false);
    expect(client.apiReachable).toBe(false);
  });
});
