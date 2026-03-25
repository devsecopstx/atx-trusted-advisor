/**
 * Display name for the seeded xPersonas RAG bucket (`atx-trusted-advisor-<dev|stage|prod>-xpersonas`).
 * Override with `XPERSONAS_XAI_COLLECTION_DISPLAY_NAME` when it must not follow NODE_ENV / deploy slug rules.
 */
export function defaultTrustedAdvisorXpersonasCollectionDisplayName(): string {
  const override = process.env.XPERSONAS_XAI_COLLECTION_DISPLAY_NAME?.trim();
  if (override) {
    return override;
  }
  const nodeEnv = String(process.env.NODE_ENV ?? "")
    .trim()
    .toLowerCase();
  let slug: string;
  if (nodeEnv === "development" || nodeEnv === "test") {
    slug = "dev";
  } else {
    const t = String(process.env.ATX_DEPLOY_TARGET ?? process.env.DEPLOY_TARGET ?? "")
      .trim()
      .toLowerCase();
    if (t === "prod" || t === "production") {
      slug = "prod";
    } else if (t === "stage" || t === "staging" || t === "deploy") {
      slug = "stage";
    } else {
      slug = "dev";
    }
  }
  return `atx-trusted-advisor-${slug}-xpersonas`;
}
