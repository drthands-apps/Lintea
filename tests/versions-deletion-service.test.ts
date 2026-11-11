import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import {canDeleteVersion, reconstructVersion } from "../src/core/versions.js";
import type { DocumentVersion } from "../src/core/versions.js";

// ---------------------------------------------------------------------------
// Helpers de servicio con reloj incremental (1 s por checkpoint)
// ---------------------------------------------------------------------------

function makeClock(start = Date.parse("2026-11-11T10:00:00.000Z")) {
  let t = start;
  return {
    now: () => new Date(t),
    tick: () => { t += 1000; return new Date(t); }
  };
}
async function setup() {
  const clock = makeClock();
  const storage = new MemoryProjectStorage();
  const service = new WorkspaceService(storage, clock.now);
  const project = await service.createProject({ title: "Pruebas" });
  const document = await service.createDocument({
    projectId: project.id,
    title: "Doc",
    text: "v0"
  });
  return { clock, storage, service, project, document };
}

async function checkpoint(
  service: WorkspaceService,
  clock: { tick: () => Date },
  docId: string,
  text: string,
  label?: string
): Promise<DocumentVersion> {
  await service.updateDocument(docId, { text });
  clock.tick();
  return service.saveDocumentVersion(docId, label ? { label } : {});
}
// ---------------------------------------------------------------------------
// Borrado lineal A→B→C→D
// ---------------------------------------------------------------------------

describe("borrado lineal A→B→C→D", () => {
  async function linear() {
    
    const ctx = await setup();
    const A = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v1", "A");
    const B = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v2", "B");
    const C = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v3", "C");
    const D = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v4", "D");
    return { ...ctx, A, B, C, D };
  }

  it("borrar C: D sigue reconstruible con su contenido", async () => {
    const { service, storage, document, A, B, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);
    expect(versions.some((v) => v.id === C.id)).toBe(false);

    const state = reconstructVersion(versions, relations, D.id, document);
    expect(state.text).toBe("v4");
  });

  it("borrar C: B intacto y reconstruible", async () => {
    const { service, storage, document, B, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });


    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);
    const state = reconstructVersion(versions, relations, B.id, document);
    expect(state.text).toBe("v2");
  });

  it("borrar C: relaciones B→C y C→D quedan interrumpidas", async () => {
    const { service, storage, document, B, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const relations = await storage.listVersionRelations(document.id);
    const intoC = relations.find((r) => r.toStateId === C.id);
    const outOfC = relations.find((r) => r.fromStateId === C.id);

    if (intoC) expect(intoC.toMissing).toBe(true);
    if (outOfC) expect(outOfC.fromMissing).toBe(true);
  });
});
// ---------------------------------------------------------------------------
// Rama A→B→C y A→D
// ---------------------------------------------------------------------------

describe("borrado con rama", () => {
  it("borrar B: C re-basado, D intacto", async () => {
    const ctx = await setup();
    const { service, storage, document, clock } = ctx;

    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    // Volver a B y abrir rama D
    await service.restoreDocumentVersion(document.id, B.id);
    const D = await checkpoint(service, clock, document.id, "v3-rama", "D");

    await service.deleteDocumentVersion(document.id,  B.id, { force: true });

    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);

    const stateC = reconstructVersion(versions, relations, C.id, document);
    expect(stateC.text).toBe("v3");

    const stateD = reconstructVersion(versions, relations, D.id, document);
    expect(stateD.text).toBe("v3-rama");
  });
});

// ---------------------------------------------------------------------------
// Borrado de pinned raíz
// ---------------------------------------------------------------------------

describe("borrado de pinned raíz", () => {
  it("los hijos delta se materializan como pinned", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id, { force: true });

    const versions = await storage.listDocumentVersions(document.id);
    const b = versions.find((v) => v.id === B.id);
    expect(b).toBeDefined();
    expect(b!.pinned).toBe(true);
    expect(b!.baseStateId).toBeUndefined();
    expect(b!.changes).toBeUndefined();

    const state = reconstructVersion(versions, [], B.id, document);
    expect(state.text).toBe("v2");
  });
});

// ---------------------------------------------------------------------------
// Grafo triangular
// ---------------------------------------------------------------------------

describe("grafo triangular", () => {
  it("borrar A deja el grafo navegable", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, A.id);
    const A2 = await checkpoint(service, clock, document.id, "v1-rama", "A2");
    const A3 = await checkpoint(service, clock, document.id, "v1-rama-2", "A3");

    await service.deleteDocumentVersion(document.id, A.id, { force: true });

    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);

    // Todos los supervivientes siguen reconstruibles.
    for (const v of versions) {
      expect(() => reconstructVersion(versions, relations, v.id, document)).not.toThrow();
    }
    expect(reconstructVersion(versions, relations, B.id, document).text).toBe("v2");
    expect(reconstructVersion(versions, relations, C.id, document).text).toBe("v3");
    expect(reconstructVersion(versions, relations, A2.id, document).text).toBe("v1-rama");
    expect(reconstructVersion(versions, relations, A3.id, document).text).toBe("v1-rama-2");
  });
});

// ---------------------------------------------------------------------------
// force y clean
// ---------------------------------------------------------------------------

describe("force y clean", () => {
  it("sin force, una relación activa bloquea el borrado", async () => {
    const { service, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await checkpoint(service, clock, document.id, "v2", "B");

    await expect(service.deleteDocumentVersion(document.id, A.id)).rejects.toThrow();
  });

  it("force permite borrar con relaciones activas y las marca interrumpidas", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id, { force: true });

    const relations = await storage.listVersionRelations(document.id);
    expect(relations.some((r) => r.fromStateId === A.id && r.fromMissing)).toBe(true);
  });

  it("clean (rechazar + borrar) deja relaciones rejected, no interrumpidas", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await checkpoint(service, clock, document.id, "v2", "B");

    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);
    const check = canDeleteVersion(versions, relations, A.id);
    expect(check.allowed).toBe(false);

    const ids = check.blockingRelations.map((r) => r.id);
    await service.rejectVersionRelations(document.id, ids);
    await service.deleteDocumentVersion(document.id, A.id);

    const after = await storage.listVersionRelations(document.id);
    expect(after.filter((r) => r.fromStateId === A.id).every((r) => r.rejected)).toBe(true);
    expect(after.filter((r) => r.fromStateId === A.id).some((r) => r.fromMissing)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Borrado de hoja
// ---------------------------------------------------------------------------

describe("borrado de hoja", () => {
  it("borrar la versión más reciente no requiere re-base", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, B.id, { force: true });

    const versions = await storage.listDocumentVersions(document.id);
    expect(versions.some((v) => v.id === B.id)).toBe(false);
    expect(reconstructVersion(versions, [], A.id, document).text).toBe("v1");
  });
});
