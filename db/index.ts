import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

function open() {
  const path = resolve(process.env.LEMMA_DB_PATH ?? "./data/lemma.db");
  mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite, { schema });
  // Migrations are idempotent, so the database is always up to date the first time it is used.
  migrate(db, { migrationsFolder: resolve("drizzle") });
  return db;
}

export type Db = ReturnType<typeof open>;

// Cached on globalThis so dev-server hot reloads reuse one connection instead of leaking new ones.
const cache = globalThis as unknown as { __lemmaDb?: Db };

export function getDb(): Db {
  return (cache.__lemmaDb ??= open());
}
