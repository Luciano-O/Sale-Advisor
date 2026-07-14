import { createDatabase } from "./client.js";
import { products } from "./schema.js";
import { GPU_TAXONOMY_SEED } from "./taxonomy.js";

const { client, db } = createDatabase();
await db
  .insert(products)
  .values([...GPU_TAXONOMY_SEED])
  .onConflictDoNothing();
await client.end();
