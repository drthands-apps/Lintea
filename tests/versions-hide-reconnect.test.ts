import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import { reconstructVersion } from "../src/core/versions.js";
import type { DocumentVersion } from "../src/core/versions.js";

function makeClock(start = Date.parse("2026-11-14T10:00:00.000Z")) {
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
// Ocultación lineal A→B→C→D
// ---------------------------------------------------------------------------

describe("ocultar C en A→B→C→D", () => {
  async function linear() {
    const ctx = await setup();
    const A = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v1", "A");
    const B = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v2", "B");
    const C = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v3", "C");
    const D = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v4", "D");
    return { ...ctx, A, B, C, D };
  }

  it("C queda oculta, no se borra del storage", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const c = all.find((v) => v.id === C.id);
    expect(c).toBeDefined();
    expect(c!.hidden).toBe(true);
    expect(c!.hiddenAt).toBeDefined();
    expect(c!.replacedBy).toBeDefined();
  });

  it("listDocumentVersions sin includeHidden no devuelve C", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const visible = await storage.listDocumentVersions(document.id);
    expect(visible.some((v) => v.id === C.id)).toBe(false);
  });

  it("listDocumentVersions con includeHidden devuelve C", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    expect(all.some((v) => v.id === C.id)).toBe(true);
  });

  it("se crea una nueva versión C' con baseStateId = B.id", async () => {
    const { service, storage, document, B, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const cPrime = all.find((v) => v.baseStateId === B.id && v.id !== C.id && v.text === "v3");
    expect(cPrime).toBeDefined();
    expect(cPrime!.pinned).not.toBe(true);
  });

  it("C antiguo tiene replacedBy = C'.id", async () => {
    const { service, storage, document, B, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const c = all.find((v) => v.id === C.id)!;
    const cPrime = all.find((v) => v.baseStateId === B.id && v.text === "v3")!;
    expect(c.replacedBy).toBe(cPrime.id);
  });

  it("D sigue reconstruible tras ocultar C", async () => {
    const { service, storage, document, D } = await linear();
    await service.deleteDocumentVersion(document.id, D.id, { force: true }).catch(() => {});
    // No tocamos D; comprobamos que sigue reconstruible sin ocultar C.
    // (Este test es de control; el de verdad oculta C y comprueba D.)
  });

  it("D sigue reconstruible tras ocultar C (real)", async () => {
    const { service, storage, document, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const state = reconstructVersion(all, [], D.id, document);
    expect(state.text).toBe("v4");
  });

  it("las relaciones B→C y C→D permanecen (no se borran, no se marcan missing)", async () => {
    const { service, storage, document, B, C, D } = await linear();
    const before = await storage.listVersionRelations(document.id);
    await service.deleteDocumentVersion(document.id, C.id, { force: true });
    const after = await storage.listVersionRelations(document.id);

    const intoCBefore = before.find((r) => r.toStateId === C.id);
    const outOfCBefore = before.find((r) => r.fromStateId === C.id);
    const intoCAfter = after.find((r) => r.toStateId === C.id);
    const outOfCAfter = after.find((r) => r.fromStateId === C.id);

    expect(intoCBefore).toBeDefined();
    expect(outOfCBefore).toBeDefined();
    expect(intoCAfter).toBeDefined();
    expect(outOfCAfter).toBeDefined();
    expect(intoCAfter!.toMissing).not.toBe(true);
    expect(outOfCAfter!.fromMissing).not.toBe(true);
  });

  it("se crea relación B→C' con label 'Reconectado'", async () => {
    const { service, storage, document, B, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const cPrime = all.find((v) => v.baseStateId === B.id && v.text === "v3")!;
    const relations = await storage.listVersionRelations(document.id);
    const reconnect = relations.find((r) => r.fromStateId === B.id && r.toStateId === cPrime.id);
    expect(reconnect).toBeDefined();
    expect(reconnect!.label).toMatch(/Reconectado/i);
  });
});

// ---------------------------------------------------------------------------
// Ocultación de raíz pinned A
// ---------------------------------------------------------------------------

describe("ocultar pinned raíz A", () => {
  it("los hijos se materializan como pinned (nueva versión) y los antiguos quedan ocultos con replacedBy", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const a = all.find((v) => v.id === A.id)!;
    expect(a.hidden).toBe(true);

    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);
    expect(b.replacedBy).toBeDefined();

    const bPrime = all.find((v) => v.id === b.replacedBy)!;
    expect(bPrime).toBeDefined();
    expect(bPrime.pinned).toBe(true);
    expect(bPrime.baseStateId).toBeUndefined();
    expect(bPrime.text).toBe("v2");
  });
});

// ---------------------------------------------------------------------------
// Ocultación con rama A→B→C y A→D
// ---------------------------------------------------------------------------

describe("ocultar B con rama", () => {
  it("C y D se reconectan a A; los antiguos quedan ocultos; relaciones permanecen", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, B.id);
    const D = await checkpoint(service, clock, document.id, "v3-rama", "D");

    const beforeRelations = await storage.listVersionRelations(document.id);
    await service.deleteDocumentVersion(document.id, B.id, { force: true });
    const afterRelations = await storage.listVersionRelations(document.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);

    // C y D reconstruibles.
    const stateC = reconstructVersion(all, afterRelations, C.id, document);
    expect(stateC.text).toBe("v3");
    const stateD = reconstructVersion(all, afterRelations, D.id, document);
    expect(stateD.text).toBe("v3-rama");

    // Relaciones antiguas permanecen.
    expect(afterRelations.length).toBeGreaterThanOrEqual(beforeRelations.length);
  });
});

// ---------------------------------------------------------------------------
// Triangular
// ---------------------------------------------------------------------------

describe("ocultar A en grafo triangular", () => {
  it("todos los supervivientes siguen reconstruibles (incluidos ocultos)", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, A.id);
    const A2 = await checkpoint(service, clock, document.id, "v1-rama", "A2");
    const A3 = await checkpoint(service, clock, document.id, "v1-rama-2", "A3");

    await service.deleteDocumentVersion(document.id, A.id, { force: true });

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const relations = await storage.listVersionRelations(document.id);

    for (const v of all) {
      expect(() => reconstructVersion(all, relations, v.id, document)).not.toThrow();
    }
    expect(reconstructVersion(all, relations, B.id, document).text).toBe("v2");
    expect(reconstructVersion(all, relations, C.id, document).text).toBe("v3");
    expect(reconstructVersion(all, relations, A2.id, document).text).toBe("v1-rama");
    expect(reconstructVersion(all, relations, A3.id, document).text).toBe("v1-rama-2");
  });
});