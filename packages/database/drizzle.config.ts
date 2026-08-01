/// <reference types="node" />
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://postgres:password@localhost:5432/codebeacon",
  },
} satisfies Config;