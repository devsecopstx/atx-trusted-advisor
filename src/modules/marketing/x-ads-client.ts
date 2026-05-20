import { getValidAccessTokenForMarketingPosting } from "./x-posting-token-manager";

/** Base for X Ads API v12. Use ads-api-sandbox.x.com for testing accounts. */
const ADS_API_BASE = process.env.X_ADS_API_BASE_URL?.trim() || "https://ads-api.x.com/12";

export type AdsAccount = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  business_name?: string;
  /** Whether the authenticated user can manage this account. */
  can_manage?: boolean;
};

export type AdsAccountListResult = {
  accounts: AdsAccount[];
  raw: unknown;
};

export type PromotedPostResult = {
  success: boolean;
  tweetId?: string;
  campaignId?: string;
  lineItemId?: string;
  promotedTweetId?: string;
  message: string;
  details?: unknown;
};

/**
 * List the X Ads accounts visible to the currently connected marketing posting token.
 * Pass xUserId (numeric) to scope the request when the token owner has access to multiple.
 */
export async function listXAdsAccounts(xUserId?: string | null): Promise<AdsAccountListResult> {
  const token = await getValidAccessTokenForMarketingPosting();
  if (!token) {
    throw new Error("No X posting token available. Connect via Admin → Marketing → Connect X for posting first.");
  }

  const url = new URL(`${ADS_API_BASE}/accounts`);
  if (xUserId?.trim()) {
    url.searchParams.set("user_id", xUserId.trim());
  }
  // Common fields to reduce payload
  url.searchParams.set("with_deleted", "false");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-json */
  }

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (json as any)?.errors?.[0]?.message || (json as any)?.detail || text.slice(0, 300);
    throw new Error(`X Ads accounts list failed (${res.status}): ${err}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData: any[] = ((json as any)?.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts: AdsAccount[] = rawData.map((a: any) => ({
    id: String(a?.id ?? ""),
    name: String(a?.name ?? a?.business_name ?? a?.id ?? ""),
    timezone: String(a?.timezone ?? "UTC"),
    currency: String(a?.currency ?? "USD"),
    business_name: a?.business_name ? String(a.business_name) : undefined,
    can_manage: typeof a?.can_manage === "boolean" ? a.can_manage : undefined
  }));

  return { accounts, raw: json };
}

/** Internal: fetch first usable funding instrument for an ads account. */
async function getFirstFundingInstrument(accountId: string, token: string): Promise<{ id: string; currency: string } | null> {
  const url = `${ADS_API_BASE}/accounts/${encodeURIComponent(accountId)}/funding_instruments?with_deleted=false`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFi: any[] = ((json as any)?.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fi = rawFi.find((f: any) => f?.entity_status === "ACTIVE" || !f?.deleted);
  if (fi && fi.id) {
    return { id: String(fi.id), currency: String(fi.currency || "USD") };
  }
  return null;
}

/**
 * Creates a tweet (via /2/tweets) and then a minimal PAUSED promoted-tweets campaign + line item in the given ads account.
 * Returns the created entity ids on success. Starts paused so the admin can review/activate in Ads Manager.
 *
 * Requirements for the ads account (common gotchas surfaced in error messages):
 * - At least one active Funding Instrument (credit card / invoice set up in Ads Manager).
 * - The OAuth token owner must have Ads Manager access to the account.
 * - The X App must have Ads API access enabled for the project.
 */
export async function createPromotedPost(params: {
  postText: string;
  accountId: string;
  /** Optional human name for the campaign/line item. */
  name?: string;
  /** Daily budget in whole USD (converted to local_micro, e.g. 25 → 25000000). Default 50. */
  dailyBudgetUsd?: number;
}): Promise<PromotedPostResult> {
  const { postText, accountId, name, dailyBudgetUsd = 50 } = params;

  const token = await getValidAccessTokenForMarketingPosting();
  if (!token) {
    return { success: false, message: "Missing X OAuth token for posting/ads. Use Connect X for posting." };
  }

  const trimmed = postText.trim();
  if (!trimmed) {
    return { success: false, message: "postText is required" };
  }
  if (!accountId?.trim()) {
    return { success: false, message: "accountId (X Ads account id) is required" };
  }

  // 1) Create the organic tweet first (so we have a real tweet_id owned by the user).
  const tweetRes = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: trimmed })
  });
  const tweetBody = await tweetRes.text();
  let tweetJson: Record<string, unknown> | null = null;
  try {
    tweetJson = JSON.parse(tweetBody) as Record<string, unknown>;
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tj = tweetJson as any;
  if (!tweetRes.ok || !tj?.data?.id) {
    const detail = tj?.detail || tj?.errors?.[0]?.message || tweetBody.slice(0, 200);
    return {
      success: false,
      message: `Failed to create base tweet before ad (${tweetRes.status}): ${detail}`
    };
  }
  const tweetId: string = String(tj.data.id);

  // 2) Resolve a funding instrument (required for campaign).
  const fi = await getFirstFundingInstrument(accountId, token);
  if (!fi) {
    return {
      success: false,
      tweetId,
      message:
        "No active funding instrument found on this ads account. Go to ads.twitter.com (or ads.x.com), add a payment method / funding source for this ads account, then retry."
    };
  }

  const campaignName = (name || `Marketing ${new Date().toISOString().slice(0, 10)}`).slice(0, 80);
  const lineItemName = `${campaignName} — promoted`;
  const dailyMicro = Math.max(1_000_000, Math.floor(dailyBudgetUsd * 1_000_000)); // at least $1

  // 3) Create Campaign (paused, with budget optimization at line item level).
  const campBody = new URLSearchParams({
    name: campaignName,
    funding_instrument_id: fi.id,
    daily_budget_amount_local_micro: String(dailyMicro),
    entity_status: "PAUSED",
    budget_optimization: "LINE_ITEM"
  });

  const campRes = await fetch(`${ADS_API_BASE}/accounts/${encodeURIComponent(accountId)}/campaigns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: campBody.toString()
  });
  const campText = await campRes.text();
  let campJson: Record<string, unknown> | null = null;
  try {
    campJson = JSON.parse(campText) as Record<string, unknown>;
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cj = campJson as any;
  const campaignId = cj?.data?.[0]?.id || cj?.data?.id;
  if (!campRes.ok || !campaignId) {
    const err = cj?.errors?.[0]?.message || campText.slice(0, 220);
    return {
      success: false,
      tweetId,
      message: `Campaign creation failed (${campRes.status}): ${err}. Check that the ads account has billing set up and the token has ads permissions.`
    };
  }

  // 4) Create Line Item (PROMOTED_TWEETS, broad-ish).
  const liBody = new URLSearchParams({
    campaign_id: String(campaignId),
    name: lineItemName,
    product_type: "PROMOTED_TWEETS",
    objective: "ENGAGEMENTS",
    placements: "ALL_ON_TWITTER",
    bid_strategy: "MAX",
    bid_amount_local_micro: "500000", // $0.50 example bid; tune in Ads Manager
    entity_status: "PAUSED",
    start_time: new Date(Date.now() + 5 * 60 * 1000).toISOString() // start soon
  });

  const liRes = await fetch(`${ADS_API_BASE}/accounts/${encodeURIComponent(accountId)}/line_items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: liBody.toString()
  });
  const liText = await liRes.text();
  let liJson: Record<string, unknown> | null = null;
  try {
    liJson = JSON.parse(liText) as Record<string, unknown>;
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lj = liJson as any;
  const lineItemId = lj?.data?.[0]?.id || lj?.data?.id;
  if (!liRes.ok || !lineItemId) {
    const err = lj?.errors?.[0]?.message || liText.slice(0, 220);
    return {
      success: false,
      tweetId,
      campaignId: String(campaignId),
      message: `Line item creation failed (${liRes.status}): ${err}. (Often needs broader targeting or different objective.)`
    };
  }

  // 5) Associate the tweet as a promoted tweet on the line item.
  const ptBody = new URLSearchParams({
    line_item_id: String(lineItemId),
    tweet_ids: String(tweetId)
  });

  const ptRes = await fetch(`${ADS_API_BASE}/accounts/${encodeURIComponent(accountId)}/promoted_tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: ptBody.toString()
  });
  const ptText = await ptRes.text();
  let ptJson: Record<string, unknown> | null = null;
  try {
    ptJson = JSON.parse(ptText) as Record<string, unknown>;
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pj = ptJson as any;
  const promotedId = pj?.data?.[0]?.id || pj?.data?.id;

  if (!ptRes.ok || !promotedId) {
    const err = pj?.errors?.[0]?.message || ptText.slice(0, 220);
    return {
      success: false,
      tweetId,
      campaignId: String(campaignId),
      lineItemId: String(lineItemId),
      message: `Promoted tweet association failed (${ptRes.status}): ${err}. The tweet may need to be visible / not restricted.`
    };
  }

  return {
    success: true,
    tweetId,
    campaignId: String(campaignId),
    lineItemId: String(lineItemId),
    promotedTweetId: String(promotedId),
    message: `Created paused promoted post. Tweet ${tweetId} attached to line item ${lineItemId}. Activate the campaign/line item in X Ads Manager to run.`
  };
}