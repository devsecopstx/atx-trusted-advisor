import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB_NAME ?? "xfinancedb";
const PERSONAS_COLLECTION = "xchat_personas";

function decodeMongoUri() {
  const encoded = process.env.MONGODB_URI_B64 ?? process.env.MONGODB_URI_B4;
  if (!encoded) {
    throw new Error("Set MONGODB_URI_B64 (or MONGODB_URI_B4)");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Decoded Mongo URI is invalid");
  }
  return decoded;
}

function normalizePersonaName(name) {
  return String(name ?? "").trim().toLowerCase();
}

async function run() {
  const client = new MongoClient(decodeMongoUri());
  await client.connect();
  const db = client.db(DB_NAME);
  const personas = db.collection(PERSONAS_COLLECTION);

  try {
    const missing = await personas
      .find(
        {
          $or: [{ nameNormalized: { $exists: false } }, { nameNormalized: "" }]
        },
        { projection: { _id: 1, name: 1 } }
      )
      .toArray();

    let updatedCount = 0;
    for (const persona of missing) {
      const nameNormalized = normalizePersonaName(persona.name);
      await personas.updateOne(
        { _id: persona._id },
        {
          $set: {
            nameNormalized
          }
        }
      );
      updatedCount += 1;
    }

    const duplicates = await personas
      .aggregate([
        {
          $group: {
            _id: "$nameNormalized",
            count: { $sum: 1 },
            ids: { $push: "$_id" }
          }
        },
        {
          $match: {
            _id: { $nin: [null, ""] },
            count: { $gt: 1 }
          }
        }
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            reason: "duplicate_normalized_persona_names",
            duplicates: duplicates.map((entry) => ({
              nameNormalized: entry._id,
              count: entry.count,
              ids: entry.ids
            }))
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    const indexName = await personas.createIndex(
      { nameNormalized: 1 },
      { unique: true, name: "uniq_xpersona_name_normalized" }
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          updatedCount,
          indexName
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
