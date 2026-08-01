import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use an environment variable for the connection string, fallback to local dev DB
const connectionString = process.env.DATABASE_URL || "postgres://postgres:password@localhost:5432/codebeacon";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export * from "./schema";