import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../src/application/workspace-service.js";
import {
  createTestSqliteStorage,
  createTestSqliteStorageFromPath,
  type TestSqliteStorage,
} from "./helpers/sqlite-test-db.js";



function makeClock(start = Date.parse("2026-11-27T10:00:00.000Z")) {
  let t = start;
  return {
    now: () => new Date(t),
    tick: () => {
      t += 1000;
      return new Date(t);
    },
  };
}

describe("ocultación de versiones con SQLite real", () => {
  let ctx: TestSqliteStorage | undefined;

  afterEach(() => {
    ctx?.close();
    ctx = undefined;
  });

  it("oculta una versión y la filtra correctamente", async () => {
    ctx = await createTestSqliteStorage();
    const clock = makeClock();
    const service = new WorkspaceService(ctx.storage, clock.now);
    const project = await service.createProject({ title: "Pruebas" });
    const document = await service.createDocument({
      projectId: project.id,
      title: "Doc",
      text: "v0",
    });

    await service.updateDocument(document.id, { text: "v1" });
    clock.tick();
    const A = await service.saveDocumentVersion(document.id, { label: "A" });

    await service.updateDocument(document.id, { text: "v2" });
    clock.tick();
    const B = await service.saveDocumentVersion(document.id, { label: "B" });

    await service.updateDocument(document.id, { text: "v3" });
    clock.tick();
    await service.saveDocumentVersion(document.id, { label: "C" });

    await service.deleteDocumentVersion(document.id, B.id);

    const visible = await service.listDocumentVersions(document.id);
    expect(visible.some((v) => v.id === B.id)).toBe(false);

    const all = await service.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const hiddenB = all.find((v) => v.id === B.id);
    expect(hiddenB).toBeDefined();
    expect(hiddenB!.hidden).toBe(true);
    expect(hiddenB!.hiddenAt).toBeDefined();

    // Verificar en BD que hidden es 1, no NULL
    const raw = await ctx.database.select<{ hidden: number | null }[]>(
      "SELECT hidden FROM document_versions WHERE id = ?",
      [B.id]
    );
    expect(raw[0]!.hidden).toBe(1);
  });

  it("persiste entre cierres y aperturas de la BD", async () => {
    ctx = await createTestSqliteStorage();
    const clock = makeClock();
    const service = new WorkspaceService(ctx.storage, clock.now);
    const project = await service.createProject({ title: "Pruebas" });
    const document = await service.createDocument({
      projectId: project.id,
      title: "Doc",
      text: "v0",
    });
    await service.updateDocument(document.id, { text: "v1" });
    clock.tick();
    const A = await service.saveDocumentVersion(document.id, { label: "A" });

    // Segunda instancia sobre la misma BD
   const second = await createTestSqliteStorageFromPath(ctx.dbPath);
   const service2 = new WorkspaceService(second.storage, clock.now);
   const versions = await service2.listDocumentVersions(document.id);
   expect(versions.some((v) => v.id === A.id)).toBe(true);
   second.close();
  });
});

