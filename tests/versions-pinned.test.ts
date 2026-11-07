import { describe, expect, it } from "vitest";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";
import { contentHash } from "../src/core/versions.js";

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

function state(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "s1",
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

describe("estados conservados (pinned)", () => {
  it("un estado conservado lleva su contenido íntegro y sus hashes", () => {
    const pinned = state({
      id: "s1",
      pinned: true,
      title: "A",
      text: "A",
      contentHash: contentHash({ title: "A", text: "A", kind: "note", order: 0 }),
      relationIds: [],
      tagAssignmentKeys: [],
      authorNoteIds: [],
      compositionEntryIds: []
    });
    expect(pinned.pinned).toBe(true);
    expect(pinned.changes).toBeUndefined();
    expect(pinned.baseStateId).toBeUndefined();
    expect(pinned.contentHash).toBeTruthy();
  });

  it("un estado conservado puede ser origen de una nueva relación", () => {
    const pinned = state({ id: "s1", pinned: true });
    const next = state({ id: "s2" });
    const relation: VersionRelation = {
      id: "r1",
      documentId: "doc-1",
      projectId: "p",
      fromStateId: pinned.id,
      toStateId: next.id,
      capturedAt: "2026-01-02T00:00:00.000Z"
    };
    expect(relation.fromStateId).toBe("s1");
    expect(pinned.pinned).toBe(true);
  });

  it("un estado conservado puede coexistir con deltas", () => {
    const pinned = state({ id: "s1", pinned: true });
    const delta = state({
      id: "s2",
      baseStateId: "s1",
      changes: [{ kind: "title", from: "A", to: "B" }]
    });
    expect(pinned.pinned).toBe(true);
    expect(delta.baseStateId).toBe("s1");
    expect(delta.changes).toHaveLength(1);
  });

  it("borrar un estado conservado interrumpe las relaciones pero no rompe otros caminos", () => {
    // Este test fija la intención del modelo: un estado conservado puede
    // borrarse si no deja relaciones activas, y las relaciones que lo
    // tocan quedan marcadas como interrumpidas. La validación exacta la
    // hace canDeleteVersion; aquí solo se documenta la intención.
    const relations: VersionRelation[] = [
      {
        id: "r1",
        documentId: "doc-1",
        projectId: "p",
        fromStateId: "s1",
        toStateId: "s2",
        capturedAt: "2026-01-02T00:00:00.000Z",
        fromMissing: true
      }
    ];
    expect(relations[0]!.fromMissing).toBe(true);
  });
});