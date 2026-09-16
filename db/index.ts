import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.LEMMA_DB_PATH ?? "./data/lemma.db";

let sqlite: Database.Database | undefined;

export function getDb() {
  if (!sqlite) {
    mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });
    sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
  }

  return drizzle(sqlite, { schema });
}
