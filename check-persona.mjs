import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/atxfinance";
const client = new MongoClient(mongoUri);

async function main() {
  try {
    await client.connect();
    const db = client.db();
    const persona = await db.collection("xchat_personas").findOne({
      _id: new ObjectId("69d07527d62b7564d242bde5")
    });
    console.log("Persona:", JSON.stringify(persona, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);