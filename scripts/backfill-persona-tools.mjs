import { MongoClient } from "mongodb";

import { resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";

const DB_NAME = process.env.MONGODB_DB_NAME ?? "atxfinancedb";
const DEFAULT_COLLECTION_ID =
  (process.env.ATXFINANCE_COLLECTION_ID || "").trim() || "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236";
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
