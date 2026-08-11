import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let cached: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Built on first use rather than at import time, so a missing DATABASE_URL
 * surfaces as a setup message in the UI instead of a module-load crash.
 *
 * postgres.js speaks plain Postgres, so the same code runs against a local
 * server in development and Neon's pooler (or Vercel Postgres) in production.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it " +
        "at a Postgres database (Neon and Vercel Postgres both work).",
    );
  }

  const client = postgres(connectionString, {
    // One connection per serverless instance, and no prepared statements —
    // both are required when running behind a transaction-mode pooler.
    max: 1,
    prepare: false,
  });

  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
