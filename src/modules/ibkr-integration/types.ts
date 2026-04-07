/**
 * Phase-1 domain models for IBKR integration (design: `atx-docs/design-system/ibkr-automation.md`).
 * No runtime I/O — wire-up to Client Portal API / persistence lands in later phases.
 */

export type IbkrAccountId = string;

export type IbkrAccount = {
  id: IbkrAccountId;
  displayName: string;
  paper: boolean;
};

export type IbkrPosition = {
  accountId: IbkrAccountId;
  symbol: string;
  quantity: number;
  averageCost?: number;
  currency?: string;
};

export type IbkrOrderSide = "buy" | "sell";

export type IbkrOrderStatus =
  | "presubmitted"
  | "submitted"
  | "filled"
  | "cancelled"
  | "rejected"
  | "unknown";

export type IbkrOrder = {
  id: string;
  accountId: IbkrAccountId;
  symbol: string;
  side: IbkrOrderSide;
  status: IbkrOrderStatus;
  quantity: number;
  parentId?: string;
};

export type IbkrExecution = {
  id: string;
  orderId: string;
  symbol: string;
  quantity: number;
  price?: number;
  executedAt: string;
};

export type IbkrAutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  version: number;
  conditionSummary: string;
  actionSummary: string;
};
