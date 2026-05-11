import { syncFinanceKnowledgeBaseToXai } from "../src/modules/xchat/finance-kb-sync";

async function main(): Promise<void> {
  const result = await syncFinanceKnowledgeBaseToXai({ repoRoot: process.cwd() });
  console.log(
    `[seed:finance-xai-collection] collection=${result.collectionId} uploaded=${result.filesUploaded}/${result.fileCandidates}`
  );
  if (result.errors.length > 0) {
    console.warn("[seed:finance-xai-collection] errors:", result.errors.slice(0, 20));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[seed:finance-xai-collection] failed", error);
  process.exitCode = 1;
});
