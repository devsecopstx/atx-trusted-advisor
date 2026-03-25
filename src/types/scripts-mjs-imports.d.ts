/** Ambient shims for TypeScript under `scripts/` that import sibling `.mjs` helpers. */

declare module "*persona-xapi-tools.mjs" {
  export function buildSuperAgentXapiTools(
    collectionIds: string | string[] | undefined
  ): Array<Record<string, unknown>>;
}

declare module "*resolve-mongo-uri.mjs" {
  export function resolveMongoUri(): string;
  export function resolveAdminSeedDbName(): string;
}

declare module "*seed-xai-rag-ingest.mjs" {
  export function collectionIdFromEntry(c: unknown): string;
  export function collectionNameFromEntry(c: unknown): string;
  export function managementListCollectionsRaw(
    mgmtKey: string,
    mgmtBase: string,
    teamId: string
  ): Promise<unknown[]>;
}

declare module "*tenant-defaults-seed.mjs" {
  export function loadSeedTenantContext(repoRoot: string): {
    yamlLoaded: boolean;
    trustedAdvisorDeploySlug: string;
    merged: {
      xaiMgmtKey: string;
      xaiMgmtBaseUrl: string;
      xaiTeamId: string;
    };
  };
  export function resolveTrustedAdvisorDeploySlug(
    settings: Record<string, string>,
    doc: unknown
  ): string;
}
