import { afterEach, describe, expect, it } from "vitest";
import { applySchema } from "../src/adapters/sqlite-project-storage.js";
import { createBareSqliteStorage, type TestSqliteStorage } from "./helpers/sqlite-test-db.js";

describe("applySchema", () => {
  let ctx: TestSqliteStorage | undefined;
  afterEach(() => {
    ctx?.close();
    ctx = undefined;
  });

  it("es idempotente: aplicarlo dos veces no falla ni duplica columnas", async () => {
    ctx = await createBareSqliteStorage();

    await applySchema(ctx.database);
    const first = await ctx.database.select<{ name: string }[]>("PRAGMA table_info(document_versions)");
    const firstNames = first.map((c) => c.name).sort();

    await applySchema(ctx.database);
    const second = await ctx.database.select<{ name: string }[]>("PRAGMA table_info(document_versions)");
    const secondNames = second.map((c) => c.name).sort();

    expect(secondNames).toEqual(firstNames);
  });

  it("crea todas las tablas esperadas en una BD vacía", async () => {
    ctx = await createBareSqliteStorage();
    await applySchema(ctx.database);

    const tables = await ctx.database.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "projects",
        "documents",
        "document_versions",
        "version_relations",
        "knowledge_entities",
        "sources",
        "relations",
        "composition_entries",
        "author_notes",
        "project_tags",
        "tag_assignments",
        "passage_tag_assignments",
      ])
    );
  });
});
