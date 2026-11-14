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
    projectId: project.id, title: "Doc", text: "v0"
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

describe("ocultar C en A→B→C→D", () => {
  async function linear() {
    const ctx = await setup();
    const A = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v1", "A");
    const B = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v2", "B");
    const C = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v3", "C");
    const D = await checkpoint(ctx.service, ctx.clock, ctx.document.id, "v4", "D");
    return { ...ctx, A, B, C, D };
  }

  it("C oculta; D' reconstruible con su contenido", async () => {
    const { service, storage, document, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const relations = await storage.listVersionRelations(document.id);
    const c = all.find((v) => v.id === C.id)!;
    expect(c.hidden).toBe(true);

    const d = all.find((v) => v.id === D.id)!;
    expect(d.hidden).toBe(true);
    const dPrime = all.find((v) => v.id === d.replacedBy)!;
    expect(reconstructVersion(all, relations, dPrime.id, document).text).toBe("v4");
  });

  it("C oculta; B intacto y reconstruible", async () => {
    const { service, storage, document, B, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const relations = await storage.listVersionRelations(document.id);
    expect(reconstructVersion(all, relations, B.id, document).text).toBe("v2");
  });

  it("relaciones B→C y C→D permanecen sin missing", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const relations = await storage.listVersionRelations(document.id);
    const intoC = relations.find((r) => r.toStateId === C.id);
    const outOfC = relations.find((r) => r.fromStateId === C.id);
    expect(intoC).toBeDefined();
    expect(outOfC).toBeDefined();
    expect(intoC!.toMissing).not.toBe(true);
    expect(outOfC!.fromMissing).not.toBe(true);
  });
});

describe("ocultar B con rama", () => {
  it("C reconectado a A; D intacto y reconstruible (no es hijo directo)", async () => {
    const ctx = await setup();
    const { service, storage, document, clock } = ctx;

    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, B.id);
    const D = await checkpoint(service, clock, document.id, "v3-rama", "D");

    await service.deleteDocumentVersion(document.id, B.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const relations = await storage.listVersionRelations(document.id);

    const c = all.find((v) => v.id === C.id)!;
    expect(c.hidden).toBe(true);
    expect(c.replacedBy).toBeDefined();
    const cPrime = all.find((v) => v.id === c.replacedBy)!;
    expect(cPrime.baseStateId).toBe(A.id);
    expect(reconstructVersion(all, relations, cPrime.id, document).text).toBe("v3");

    const d = all.find((v) => v.id === D.id)!;
    expect(d.hidden).not.toBe(true);
    expect(d.replacedBy).toBeUndefined();
    expect(reconstructVersion(all, relations, D.id, document).text).toBe("v3-rama");
  });
});

describe("ocultar pinned raíz", () => {
  it("los hijos se materializan como pinned", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);
    const bPrime = all.find((v) => v.id === b.replacedBy)!;
    expect(bPrime.pinned).toBe(true);
    expect(bPrime.baseStateId).toBeUndefined();

    const relations = await storage.listVersionRelations(document.id);
    expect(reconstructVersion(all, relations, bPrime.id, document).text).toBe("v2");
  });
});

describe("grafo triangular", () => {
  it("ocultar A deja el grafo navegable", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, A.id);
    const A2 = await checkpoint(service, clock, document.id, "v1-rama", "A2");
    const A3 = await checkpoint(service, clock, document.id, "v1-rama-2", "A3");

    await service.deleteDocumentVersion(document.id, A.id);

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

describe("ocultar con relaciones activas", () => {
  it("ocultar no lanza y las relaciones permanecen", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const a = all.find((v) => v.id === A.id)!;
    expect(a.hidden).toBe(true);

    const relations = await storage.listVersionRelations(document.id);
    const aToB = relations.find((r) => r.fromStateId === A.id && r.toStateId === B.id);
    expect(aToB).toBeDefined();
    expect(aToB!.fromMissing).not.toBe(true);
  });
});

describe("ocultar hoja", () => {
  it("ocultar la versión más reciente no requiere reconexión", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, B.id);

    const all = await storage.listDocumentVersions(document.id, { includeHidden: true });
    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);
    expect(b.replacedBy).toBeUndefined();
    expect(reconstructVersion(all, [], A.id, document).text).toBe("v1");
  });
});

describe("des-ocultar", () => {
  it("unhideDocumentVersion vuelve a mostrar la versión", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await service.deleteDocumentVersion(document.id, A.id);

    const hidden = await storage.listDocumentVersions(document.id);
    expect(hidden.some((v) => v.id === A.id)).toBe(false);

    await service.unhideDocumentVersion(document.id, A.id);

    const visible = await storage.listDocumentVersions(document.id);
    expect(visible.some((v) => v.id === A.id)).toBe(true);
    const a = visible.find((v) => v.id === A.id)!;
    expect(a.hidden).not.toBe(true);
    expect(a.hiddenAt).toBeUndefined();
  });

  it("des-ocultar es idempotente si ya está visible", async () => {
    const { service, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await expect(service.unhideDocumentVersion(document.id, A.id)).resolves.toBeUndefined();
  });
});

describe("coincidencia con el estado actual", () => {
  it("currentStateMatchesVersion detecta coincidencia por contenido", async () => {
    const { service, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    expect(await service.currentStateMatchesVersion(document.id, A.id)).toBe(true);
  });

  it("currentStateMatchesVersion no detecta coincidencia si el texto cambió", async () => {
    const { service, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    await service.updateDocument(document.id, { text: "v1-modificado" });
    expect(await service.currentStateMatchesVersion(document.id, A.id)).toBe(false);
  });
});