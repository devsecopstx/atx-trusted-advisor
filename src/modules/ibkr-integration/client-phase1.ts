import type { IbkrIntegrationConfig } from "@/modules/ibkr-integration/config";

/**
 * Phase-1 client surface: flags + explicit `apiReachable: false`.
 * No network, sessions, or secrets — avoids changing product behavior when IBKR_ENABLED is off.
 */
export type IbkrClientPhase1 = {
  readonly phase: 1;
  readonly enabled: boolean;
  readonly paperTrading: boolean;
  readonly apiReachable: false;
};

export function createIbkrClientPhase1(config: IbkrIntegrationConfig): IbkrClientPhase1 {
  return {
    phase: 1,
    enabled: config.enabled,
    paperTrading: config.paperTrading,
    apiReachable: false
  };
}
