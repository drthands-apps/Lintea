import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import {
  canDeleteVersion,
  contentHash,
  reconstructVersion
} from "../src/core/versions.js";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";
import type { DocumentRecord } from "../src/core/model.js";

// ---------------------------------------------------------------------------
// Helpers puros (mismo patrón que tests/versions-deletion.test.ts)
// ---------------------------------------------------------------------------

function version(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "v1",
    documentId: "doc-1",
    projectId: "p",
    title: "Título",
    text: "Texto",
    kind: "note",
    order: 0,
    capturedAt: "2026-01-01T00:00:00.000Z",
    documentUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function relation(overrides: Partial<VersionRelation> = {}): VersionRelation {
  return {
    id: "r1",
    documentId: "doc-1",
    projectId: "p",
    fromStateId: "s1",
    toStateId: "s2",
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function doc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    projectId: "p",
    title: "Título",
    text: "Texto",
    kind: "note",
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

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
// reconstructVersion: kind/order
// ---------------------------------------------------------------------------

describe("reconstructVersion conserva kind y order", () => {
  it("una versión pinned conserva kind y order", () => {
    const base = doc({ kind: "fragment", order: 3 });
    const pinned = version({
      pinned: true,
      kind: "fragment",
      order: 3,
      contentHash: contentHash({ title: "Título", text: "Texto", kind: "fragment", order: 3 })
    });

    const state = reconstructVersion([pinned], [], pinned.id, base);

    expect(state.kind).toBe("fragment");
    expect(state.order).toBe(3);
  });

  it("un delta hereda kind y order de su base pinned", () => {
    const base = doc({ kind: "fragment", order: 3 });
    const pinned = version({
      id: "p1",
      pinned: true,
      kind: "fragment",
      order: 3,
      text: "Texto base",
      contentHash: contentHash({ title: "Título", text: "Texto base", kind: "fragment", order: 3 })
    });
    const delta = version({
      id: "d1",
      pinned: false,
      baseStateId: "p1",
      text: "Texto delta",
      kind: "fragment",
      order: 3,
      changes: [{ kind: "text", from: "Texto base", to: "Texto delta", hunks: [] }],
      contentHash: contentHash({ title: "Título", text: "Texto delta", kind: "fragment", order: 3 })
    });

    const state = reconstructVersion([delta, pinned], [], delta.id, base);

    expect(state.kind).toBe("fragment");
    expect(state.order).toBe(3);
    expect(state.text).toBe("Texto delta");
  });
});

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
  it("canDeleteVersion permite borrar C si sus relaciones están rechazadas", async () => {
    const { service, storage, document, C } = await linear();

    const versions = await storage.listDocumentVersions(document.id);
    const relations = await storage.listVersionRelations(document.id);
    const check = canDeleteVersion(versions, relations, C.id);
    expect(check.allowed).toBe(false);

    const ids = check.blockingRelations.map((r) => r.id);
    await service.rejectVersionRelations(document.id, ids);

    const versions2 = await storage.listDocumentVersions(document.id);
    const relations2 = await storage.listVersionRelations(document.id);
    const check2 = canDeleteVersion(versions2, relations2, C.id);
    expect(check2.allowed).toBe(true);
  });
});

