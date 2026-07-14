import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client.js";

const { client, db } = createDatabase();
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await client.end();
