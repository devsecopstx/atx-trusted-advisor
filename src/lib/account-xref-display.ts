/**
 * Broker / custodian account external ref (extAccountId) — user-facing display only.
 * Full value is treated as secret; only the last four characters are shown when length > 4.
 */

/** Keep in sync with `DEFAULT_ACCOUNT_REF` in `modules/core-admin/repository.ts`. */
export const FIDELITY_DEFAULT_PROVISION_ACCOUNT_REF = "fidelity-default-account";

/**
 * True when the stored ref is empty, a seeded default placeholder, or an auto-generated
 * `atx-…` id — i.e. the user has not set a real broker account id yet.
 */
export function isProvisioningPortfolioAccountRef(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  if (!s) {
    return true;
  }
  if (s === FIDELITY_DEFAULT_PROVISION_ACCOUNT_REF) {
    return true;
  }
  return /^atx-[a-f0-9]{12}$/i.test(s);
}

export function maskAccountXrefForDisplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) {
    return "—";
  }
  if (s.length <= 4) {
    return "••••";
  }
  return `••••${s.slice(-4)}`;
}

/**
 * Import-activity / high-privacy surfaces: show **only** the last four characters (no leading bullets).
 * Short refs (≤4 chars) are not shown in clear — use a fixed mask.
 */
export function accountRefLastFourOnlyDisplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) {
    return "—";
  }
  if (s.length <= 4) {
    return "••••";
  }
  return s.slice(-4);
}
