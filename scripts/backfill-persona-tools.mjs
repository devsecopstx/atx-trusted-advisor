import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

const DB_NAME = resolveSeedDbName();
const RAW_XAI_TEAM = (process.env.XAI_TEAM_ID || "").trim();
const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;
const DEFAULT_COLLECTION_ID = XAI_KB_COLLECTION_RE.test(RAW_XAI_TEAM) ? RAW_XAI_TEAM : "";
if (!DEFAULT_COLLECTION_ID) {
  console.error(
    "backfill-persona-tools: set XAI_TEAM_ID to your xAI KB collection id (collection_*)."
  );
  process.exit(1);
}
const DEFAULT_TOOLS = [
  { type: "web_search" },
  { type: "x_search" },
  { type: "file_search", source: { collection_ids: [DEFAULT_COLLECTION_ID] } },
  { type: "atxfinance" }
];

async function backfill() {
  const mongoUri = resolveMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);

  try {
    const personas = await db
      .collection("xchat_personas")
      .find({
        $or: [
          { "xapi.tools": { $exists: false } },
          { "xapi.tools": { $size: 0 } },
          { xapi: { $exists: false } }
        ]
      })
      .toArray();

    console.log(`Found ${personas.length} persona(s) missing xapi.tools`);

    let updated = 0;
    for (const persona of personas) {
      const existingXapi = persona.xapi ?? {};
      const result = await db.collection("xchat_personas").updateOne(
        { _id: persona._id },
        {
          $set: {
            xapi: {
              mode: existingXapi.mode ?? "responses",
              toolChoice: existingXapi.toolChoice ?? "auto",
              maxTurns: existingXapi.maxTurns ?? 5,
              tools: DEFAULT_TOOLS
            },
            updatedAt: new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        updated++;
        console.log(
          `  Updated "${persona.name}" (${String(persona._id)}) with default tools`
        );
      }
    }

    console.log(
      JSON.stringify({
        ok: true,
        scanned: personas.length,
        updated,
        defaultTools: DEFAULT_TOOLS
      }, null, 2)
    );
  } finally {
    await client.close();
  }
}

backfill().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
