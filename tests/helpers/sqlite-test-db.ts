import BetterSqlite3 from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteProjectStorage, applySchema } from "../../src/adapters/sqlite-project-storage.js";
import type { SqliteDatabase } from "../../src/adapters/sqlite-database.js";

class BetterSqliteAdapter implements SqliteDatabase {
  constructor(private readonly db: BetterSqlite3.Database) {}

  async execute(query: string, bindValues: unknown[] = []) {
    const result = this.db.prepare(query).run(...(bindValues as any[]));
    return { rowsAffected: result.changes };
  }

  async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    return this.db.prepare(query).all(...(bindValues as any[])) as T;
  }

  close() {
    this.db.close();
  }
}

export interface TestSqliteStorage {
  storage: SqliteProjectStorage;
  dbPath: string;
  database: SqliteDatabase;
  close: () => void;
}

export async function createTestSqliteStorage(): Promise<TestSqliteStorage> {
  const dir = mkdtempSync(join(tmpdir(), "lintea-test-"));
  const dbPath = join(dir, "lintea.db");
  const raw = new BetterSqlite3(dbPath);
  raw.pragma("journal_mode = WAL");
  const adapter = new BetterSqliteAdapter(raw);
  await applySchema(adapter);
  const storage = new SqliteProjectStorage(adapter);
  return {
    storage,
    dbPath,
    database: adapter,
    close: () => {
      adapter.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function createTestSqliteStorageFromPath(dbPath: string): Promise<TestSqliteStorage> {
  const raw = new BetterSqlite3(dbPath);
  raw.pragma("journal_mode = WAL");
  const adapter = new BetterSqliteAdapter(raw);
  await applySchema(adapter);
  const storage = new SqliteProjectStorage(adapter);
  return {
    storage,
    dbPath,
    database: adapter,
    close: () => adapter.close(),
  };
}
