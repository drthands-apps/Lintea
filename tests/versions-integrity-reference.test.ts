import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "../src/core/versions.js";
import { referenceHash, reconstructVersion } from "../src/core/versions.js";
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

describe("integridad referencial del historial", () => {
  it("marca como missing una relación que ya no existe al reconstruir", () => {
    const current = state({ relationIds: [] });
    const old = version({
      id: "v1",
      relationIds: ["r1"],
      referenceHash: referenceHash({ ...current, relationIds: ["r1"] })
    });
    const result = reconstructVersion([old], "v1", current);
    expect(result.referenceStatus.relations["r1"]).toBe("missing");
  });

  it("marca como ok una relación que sigue existiendo", () => {
    const current = state({ relationIds: ["r1"] });
    const old = version({
      id: "v1",
      relationIds: ["r1"],
      referenceHash: referenceHash({ ...current, relationIds: ["r1"] })
    });
    const result = reconstructVersion([old], "v1", current);
    expect(result.referenceStatus.relations["r1"]).toBe("ok");
  });

  it("el referenceHash de una versión histórica no cambia al añadir relaciones nuevas", () => {
    const before = state({ relationIds: [] });
    const old = version({
      id: "v1",
      relationIds: [],
      referenceHash: referenceHash(before)
    });
    const afterAdding = state({ relationIds: ["r-new"] });
    const result = reconstructVersion([old], "v1", afterAdding);
    // La versión histórica no incluye r-new: el hash guardado sigue siendo válido.
    expect(result.referenceStatus.relations["r-new"]).toBeUndefined();
  });

  it("referenceStatus solo incluye las referencias de la versión histórica", () => {
    const current = state({ relationIds: ["r-old", "r-new"] });
    const old = version({
     id: "v1",
     relationIds: ["r-old"],
     referenceHash: referenceHash({ ...current, relationIds: ["r-old"] })
    });
    const result = reconstructVersion([old], "v1", current);
    expect(result.referenceStatus.relations["r-old"]).toBe("ok");
    expect(result.referenceStatus.relations["r-new"]).toBeUndefined();
    });
});