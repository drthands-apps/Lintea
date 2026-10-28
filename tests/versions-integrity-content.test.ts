import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "../src/core/versions.js";
import {
  CURRENT_BASE_VERSION_ID,
  contentHash,
  reconstructVersion
} from "../src/core/versions.js";
import type { DocumentState } from "../src/core/versions.js";

function state(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    documentId: "doc-1",
    projectId: "p",
    title: "Actual",
    text: "Actual",
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
    title: "Actual",
    text: "Actual",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("integridad de contenido del historial", () => {
  it("reconstruye una versión histórica aplicando cambios hacia atrás desde la base", () => {
    const current = state({ title: "Actual", text: "Actual" });
    const old = version({
      id: "v1",
      parentVersionId: CURRENT_BASE_VERSION_ID,
      title: "Antigua",
      text: "Antigua",
      contentHash: contentHash({ ...current, title: "Antigua", text: "Antigua" }),
      changes: [
        { kind: "title", from: "Actual", to: "Antigua" },
        { kind: "text", from: "Actual", to: "Antigua", hunks: [] }
      ]
    });
    const result = reconstructVersion([old], "v1", current);
    expect(result.title).toBe("Antigua");
    expect(result.text).toBe("Antigua");
  });

  it("marca como corrupta una versión cuyo contentHash no coincide", () => {
    const current = state({ title: "Actual", text: "Actual" });
    const corrupted = version({
      id: "v1",
      parentVersionId: CURRENT_BASE_VERSION_ID,
      title: "Antigua",
      text: "Antigua",
      contentHash: "hash-incorrecto",
      changes: [
        { kind: "title", from: "Actual", to: "Antigua" },
        { kind: "text", from: "Actual", to: "Antigua", hunks: [] }
      ]
    });
    expect(() => reconstructVersion([corrupted], "v1", current)).toThrow(/corrupta/);
  });

  it("A→B→A reconstruye A con el mismo contentHash que la base A", () => {
    const a = state({ title: "A", text: "A" });
    const b = state({ title: "B", text: "B" });
    const versionA: DocumentVersion = version({
      id: "va",
      parentVersionId: CURRENT_BASE_VERSION_ID,
      title: "A",
      text: "A",
      contentHash: contentHash(a),
      changes: [
        { kind: "title", from: "B", to: "A" },
        { kind: "text", from: "B", to: "A", hunks: [] }
      ]
    });
    const versionB: DocumentVersion = version({
      id: "vb",
      parentVersionId: "va",
      title: "B",
      text: "B",
      contentHash: contentHash(b),
      changes: [
        { kind: "title", from: "A", to: "B" },
        { kind: "text", from: "A", to: "B", hunks: [] }
      ]
    });
    // Reconstruir vb desde una base actual que es A debe devolver B.
    const result = reconstructVersion([versionA, versionB], "vb", a);
    expect(result.title).toBe("B");
    expect(contentHash(result)).toBe(contentHash(b));
  });

  it("rechaza aplicar deltas cuyo padre no existe en la cadena", () => {
    const current = state({ title: "C", text: "C" });
    const a: DocumentVersion = version({
      id: "a",
      parentVersionId: CURRENT_BASE_VERSION_ID,
      title: "A",
      text: "A",
      contentHash: contentHash(state({ title: "A", text: "A" })),
      changes: [
        { kind: "title", from: "C", to: "A" },
        { kind: "text", from: "C", to: "A", hunks: [] }
      ]
    });
    const c: DocumentVersion = version({
      id: "c",
      parentVersionId: "b", // "b" no existe
      title: "C",
      text: "C",
      contentHash: contentHash(current),
      changes: [{ kind: "title", from: "B", to: "C" }]
    });
    expect(() => reconstructVersion([a, c], "c", current)).toThrow(/padre/);
  });
});