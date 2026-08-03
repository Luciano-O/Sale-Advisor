import { createDatabase } from "./client.js";
import { products } from "./schema.js";
import { GPU_TAXONOMY_SEED } from "./taxonomy.js";

const connection = createDatabase();
const { db } = connection;
await db
  .insert(products)
  .values([...GPU_TAXONOMY_SEED])
  .onConflictDoNothing();
await connection.close();
