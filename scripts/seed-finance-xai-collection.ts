import { syncFinanceKnowledgeBaseToXai } from "../src/modules/xchat/finance-kb-sync";

async function main(): Promise<void> {
  const result = await syncFinanceKnowledgeBaseToXai({ repoRoot: process.cwd() });
  console.log(
    `[seed:finance-xai-collection] collection=${result.collectionId} uploaded=${result.filesUploaded}/${result.fileCandidates} created=${result.documentsCreated} updated=${result.documentsUpdated} remoteIndexed=${result.existingRemoteDocuments} fieldDefs=${result.collectionFieldDefinitionKeys.length}`
  );
  if (result.collectionFieldDefinitionKeys.length > 0) {
    console.log(
      `[seed:finance-xai-collection] collection field_definitions keys: ${result.collectionFieldDefinitionKeys.join(", ")}`
    );
  }
  for (const row of result.changes) {
    const prev = row.previousFileId ? ` replaced=${row.previousFileId}` : "";
    const fields =
      row.fieldKeysSent.length > 0 ? ` fields=[${row.fieldKeysSent.join(",")}]` : " fields=[]";
    const link = row.alreadyLinked ? " link=409_already_linked" : "";
    console.log(
      `  [${row.action}] ${row.source}/${row.relativePath} -> ${row.newFileId}${prev}${fields}${link}`
    );
  }
  if (result.collectionFieldDefinitionKeys.length === 0) {
    console.warn(
      "[seed:finance-xai-collection] hint: GET collection returned no field_definitions keys (check API JSON: field_definitions vs fieldDefinitions); native xAI document fields will stay empty."
    );
  } else if (result.changes.length > 0 && !result.changes.some((c) => c.fieldKeysSent.length > 0)) {
    console.warn(
      `[seed:finance-xai-collection] hint: field_definitions=[${result.collectionFieldDefinitionKeys.join(", ")}] but nothing matched repo metadata keys (underscore/camelCase is normalized). Add matching YAML keys or rename xAI fields.`
    );
  }
  if (result.errors.length > 0) {
    console.warn("[seed:finance-xai-collection] errors:", result.errors.slice(0, 20));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[seed:finance-xai-collection] failed", error);
  process.exitCode = 1;
});
