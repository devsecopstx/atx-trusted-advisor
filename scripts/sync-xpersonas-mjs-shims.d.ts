declare module "./lib/persona-xapi-tools.mjs" {
  export function buildSuperAgentXapiTools(
    collectionIds: string | string[] | undefined
  ): Array<Record<string, unknown>>;
  export function buildAdvisorXapiTools(
    collectionIds: string | string[] | undefined
  ): Array<Record<string, unknown>>;
}

declare module "./lib/resolve-mongo-uri.mjs" {
  export function resolveMongoUri(): string;
  export function resolveSeedDbName(): string;
  export function resolveAdminSeedDbName(): string;
}

declare module "./lib/seed-xai-rag-ingest.mjs" {
  export function collectionIdFromEntry(c: unknown): string;
  export function collectionNameFromEntry(c: unknown): string;
  export function managementListCollectionsRaw(
    mgmtKey: string,
    mgmtBase: string,
    teamId: string
  ): Promise<unknown[]>;
}

declare module "./lib/tenant-defaults-seed.mjs" {
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
