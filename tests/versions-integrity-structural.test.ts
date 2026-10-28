import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "../src/core/versions.js";
import { reconstructVersion } from "../src/core/versions.js";
import type { DocumentState } from "../src/core/versions.js";

function state(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    documentId: "doc-1",
    projectId: "p",
    title: "Título",
    text: "Texto",
    kind: "note",
    order: 0,
    relationIds: [],
    tagAssignmentKeys: [],
    authorNoteIds: [],
    compositionEntryIds: [],
    capturedAt: "2026-01-01T00:00:00.000Z",
    documentUpdatedAt: "2026-01-01T00:00:00.000Z",
    referenceStatus: { relations: {}, tagAssignments: {}, authorNotes: {}, compositionEntries: {} },
    ...overrides
  };
}

function version(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "v1",
    documentId: "doc-1",
    projectId: "p",
    title: "Título",
    text: "Texto",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("integridad estructural del historial", () => {
  it("rechaza un delta sin parentVersionId", () => {
    const current = state();
    const bad: DocumentVersion = version({ id: "v2", changes: [], contentHash: "x", referenceHash: "y" });
    expect(() => reconstructVersion([bad], "v2", current)).toThrow(/parentVersionId/);
  });

  it("rechaza un delta cuyo padre no existe", () => {
    const current = state();
    const bad: DocumentVersion = version({ id: "v2", parentVersionId: "no-existe", changes: [], contentHash: "x", referenceHash: "y" });
    expect(() => reconstructVersion([bad], "v2", current)).toThrow(/padre/);
  });

  it("rechaza un delta cuyo padre es de otro documento", () => {
    const current = state();
    const parent: DocumentVersion = version({ id: "v1", documentId: "otro", changes: [], contentHash: "x", referenceHash: "y" });
    const child: DocumentVersion = version({ id: "v2", parentVersionId: "v1", changes: [], contentHash: "x", referenceHash: "y" });
    expect(() => reconstructVersion([parent, child], "v2", current)).toThrow(/documento/);
  });

  it("rechaza un ciclo en la cadena", () => {
    const current = state();
    const a: DocumentVersion = version({ id: "a", parentVersionId: "b", changes: [], contentHash: "x", referenceHash: "y" });
    const b: DocumentVersion = version({ id: "b", parentVersionId: "a", changes: [], contentHash: "x", referenceHash: "y" });
    expect(() => reconstructVersion([a, b], "a", current)).toThrow(/ciclo/);
  });

  it("acepta una instantánea antigua sin parentVersionId como base", () => {
    const current = state({ title: "Actual", text: "Actual" });
    const base: DocumentVersion = version({ id: "v1", title: "Antigua", text: "Antigua" });
    const result = reconstructVersion([base], "v1", current);
    expect(result.title).toBe("Antigua");
    expect(result.text).toBe("Antigua");
  });
});