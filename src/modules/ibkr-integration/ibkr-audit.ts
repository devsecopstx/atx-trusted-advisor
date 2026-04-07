export type IbkrAuditFields = {
  /** Per-request id; echoed on `X-Correlation-Id` for log ↔ client support matching. */
  correlationId: string;
  op: string;
  userIdMasked: string;
  accountIdMasked?: string;
  httpStatus?: number;
  ok: boolean;
  detail?: string;
  sessionSource?: "user_cookie" | "env";
};

/**
 * Structured, cookie-safe audit line for outbound IBKR / integration ops.
 */
export function logIbkrAudit(fields: IbkrAuditFields): void {
  const payload = {
    type: "ibkr_audit",
    ...fields
  };
  if (fields.ok) {
    console.info("[ibkr/audit]", JSON.stringify(payload));
  } else {
    console.warn("[ibkr/audit]", JSON.stringify(payload));
  }
}
