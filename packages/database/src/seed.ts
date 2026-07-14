import { createDatabase } from "./client.js";

const { client } = createDatabase();
await client.end();
