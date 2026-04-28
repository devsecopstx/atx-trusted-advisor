import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import type { AccessRequest } from "@/modules/core-admin/types";
import type { CoreUser } from "@/modules/identity/types";

/**
 * Email address to use for access-approval transactional mail and bootstrap metadata.
 * Prefer a **real** inbox: core user email when not an X placeholder; otherwise **`contactEmail`**
 * from the access request (guest form / session email captured at request time).
 */
export function resolveAccessApprovalNotifyEmail(
  user: Partial<Pick<CoreUser, "email">>,
  accessRequest: Partial<Pick<AccessRequest, "contactEmail">>
): string | null {
  const ordered = [user.email?.trim(), accessRequest.contactEmail?.trim()].filter(
    (e): e is string => typeof e === "string" && e.length > 0
  );
  const deliverable = ordered.find((e) => !isXIdentityPlaceholderEmail(e));
  return deliverable ?? null;
}
