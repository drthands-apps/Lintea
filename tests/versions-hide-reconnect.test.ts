import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import { reconstructVersion } from "../src/core/versions.js";
import type { DocumentVersion } from "../src/core/versions.js";

function makeClock(start = Date.parse("2026-11-14T10:00:00.000Z")) {
  let t = start;
  return {
    now: () => new Date(t),
    tick: () => {
      t += 1000;
      return new Date(t);
    },
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
    text: "v0",
  });
  return { clock, storage, service, project, document };
}

async function checkpoint(
  service: WorkspaceService,
  clock: { tick: () => Date },
  docId: string,
  text: string,
  label?: string,
): Promise<DocumentVersion> {
  await service.updateDocument(docId, { text });
  clock.tick();
  return service.saveDocumentVersion(docId, label ? { label } : {});
}

// ---------------------------------------------------------------------------
// Ocultación lineal A→B→C→D, ocultar C
// ---------------------------------------------------------------------------

describe("ocultar C en A→B→C→D", () => {
  async function linear() {
    const ctx = await setup();
    const A = await checkpoint(
      ctx.service,
      ctx.clock,
      ctx.document.id,
      "v1",
      "A",
    );
    const B = await checkpoint(
      ctx.service,
      ctx.clock,
      ctx.document.id,
      "v2",
      "B",
    );
    const C = await checkpoint(
      ctx.service,
      ctx.clock,
      ctx.document.id,
      "v3",
      "C",
    );
    const D = await checkpoint(
      ctx.service,
      ctx.clock,
      ctx.document.id,
      "v4",
      "D",
    );
    return { ...ctx, A, B, C, D };
  }

  it("C queda oculta, no se borra, sin replacedBy (C no se reemplaza, se oculta)", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const c = all.find((v) => v.id === C.id);
    expect(c).toBeDefined();
    expect(c!.hidden).toBe(true);
    expect(c!.hiddenAt).toBeDefined();
    expect(c!.replacedBy).toBeUndefined();
  });

  it("listDocumentVersions sin includeHidden no devuelve C", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const visible = await storage.listDocumentVersions(document.id);
    expect(visible.some((v) => v.id === C.id)).toBe(false);
  });

  it("listDocumentVersions con includeHidden devuelve C", async () => {
    const { service, storage, document, C } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    expect(all.some((v) => v.id === C.id)).toBe(true);
  });

  it("C oculta; D queda intacto (sin replacedBy)", async () => {
    const { service, storage, document, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const d = all.find((v) => v.id === D.id)!;
    expect(d.hidden).not.toBe(true);
    expect(d.replacedBy).toBeUndefined();
    expect(d.text).toBe("v4");
  });

  it("D reconstruible tras ocultar C (usando includeHidden)", async () => {
    const { service, storage, document, C, D } = await linear();
    await service.deleteDocumentVersion(document.id, C.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const relations = await storage.listVersionRelations(document.id);
    const state = reconstructVersion(all, relations, D.id, document);
    expect(state.text).toBe("v4");
  });

  it("no se crea ninguna relación nueva al ocultar C", async () => {
    const { service, storage, document, C } = await linear();
    const before = await storage.listVersionRelations(document.id);
    await service.deleteDocumentVersion(document.id, C.id);
    const after = await storage.listVersionRelations(document.id);
    expect(after.length).toBe(before.length);
  });

  it("las relaciones B→C y C→D permanecen (no se borran, no se marcan missing)", async () => {
    const { service, storage, document, C } = await linear();
    const before = await storage.listVersionRelations(document.id);
    await service.deleteDocumentVersion(document.id, C.id);
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
});

// ---------------------------------------------------------------------------
// Ocultación de raíz pinned A
// ---------------------------------------------------------------------------

describe("ocultar pinned raíz A", () => {
  it("ocultar A no materializa B; B queda intacto", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const a = all.find((v) => v.id === A.id)!;
    expect(a.hidden).toBe(true);
    expect(a.replacedBy).toBeUndefined();

    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).not.toBe(true);
    expect(b.replacedBy).toBeUndefined();
    expect(b.text).toBe("v2");
  });
});

// ---------------------------------------------------------------------------
// Ocultación con rama A→B→C y A→D
// ---------------------------------------------------------------------------

describe("ocultar B con rama", () => {
  it("ocultar B no reconecta C; C y D intactos; relaciones permanecen", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");
    const C = await checkpoint(service, clock, document.id, "v3", "C");

    await service.restoreDocumentVersion(document.id, B.id);
    const D = await checkpoint(service, clock, document.id, "v3-rama", "D");

    const beforeRelations = await storage.listVersionRelations(document.id);
    await service.deleteDocumentVersion(document.id, B.id);
    const afterRelations = await storage.listVersionRelations(document.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);
    expect(b.replacedBy).toBeUndefined();

    // C y D intactos: no se reconecta ni se reemplaza nada.
    const c = all.find((v) => v.id === C.id)!;
    expect(c.hidden).not.toBe(true);
    expect(c.replacedBy).toBeUndefined();

    const d = all.find((v) => v.id === D.id)!;
    expect(d.hidden).not.toBe(true);
    expect(d.replacedBy).toBeUndefined();

    // Todo sigue siendo reconstruible.
    expect(reconstructVersion(all, afterRelations, C.id, document).text).toBe(
      "v3",
    );
    expect(reconstructVersion(all, afterRelations, D.id, document).text).toBe(
      "v3-rama",
    );

    // Relaciones antiguas permanecen sin cambios.
    expect(afterRelations.length).toBe(beforeRelations.length);
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

    await service.deleteDocumentVersion(document.id, A.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const relations = await storage.listVersionRelations(document.id);

    for (const v of all) {
      expect(() =>
        reconstructVersion(all, relations, v.id, document),
      ).not.toThrow();
    }
    expect(reconstructVersion(all, relations, B.id, document).text).toBe("v2");
    expect(reconstructVersion(all, relations, C.id, document).text).toBe("v3");
    expect(reconstructVersion(all, relations, A2.id, document).text).toBe(
      "v1-rama",
    );
    expect(reconstructVersion(all, relations, A3.id, document).text).toBe(
      "v1-rama-2",
    );
  });
});

// ---------------------------------------------------------------------------
// Contrato nuevo: cualquier versión es ocultable
// ---------------------------------------------------------------------------

describe("contrato nuevo de ocultación", () => {
  it("ocultar la versión actual está permitido", async () => {
    const { service, storage, document, clock } = await setup();
    await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, B.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const b = all.find((v) => v.id === B.id)!;
    expect(b.hidden).toBe(true);

    await service.unhideDocumentVersion(document.id, B.id);
    const visible = await storage.listDocumentVersions(document.id);
    expect(visible.some((v) => v.id === B.id)).toBe(true);
  });

  it("ocultar la base A está permitido y no rompe la reconstrucción de B", async () => {
    const { service, storage, document, clock } = await setup();
    const A = await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    await service.deleteDocumentVersion(document.id, A.id);

    const all = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    const relations = await storage.listVersionRelations(document.id);
    const a = all.find((v) => v.id === A.id)!;
    expect(a.hidden).toBe(true);
    expect(reconstructVersion(all, relations, B.id, document).text).toBe("v2");
  });

  it("ocultar no crea versiones nuevas", async () => {
    const { service, storage, document, clock } = await setup();
    await checkpoint(service, clock, document.id, "v1", "A");
    const B = await checkpoint(service, clock, document.id, "v2", "B");

    const before = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });
    await service.deleteDocumentVersion(document.id, B.id);
    const after = await storage.listDocumentVersions(document.id, {
      includeHidden: true,
    });

    expect(after.length).toBe(before.length);
  });
});
