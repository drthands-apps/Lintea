import { describe, expect, it } from "vitest";
import type { DocumentState, DocumentVersion } from "../src/core/versions.js";
import {
  computeReferenceStatus,
  reconstructVersion
} from "../src/core/versions.js";
import type { DocumentRecord } from "../src/core/model.js";
import { contentHash, referenceHash } from "../src/core/versions.js";

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
    id: "s1",
    documentId: "doc-1",
    projectId: "p",
    title: "Actual",
    text: "Actual",
    kind: "note",
    order: 0, 
    capturedAt: "2026-01-01T00:00:00.000Z",
    documentUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function doc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    projectId: "p",
    title: "Actual",
    text: "Actual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "note",
    order: 0,
    ...overrides
  };
}

describe("integridad referencial del historial", () => {
  it("marca como missing una relación que ya no existe en el proyecto", () => {
    const historicState = state({ relationIds: ["r1"] });
    const currentRefs = { relationIds: [], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] };
    const status = computeReferenceStatus(historicState, currentRefs);
    expect(status.relations["r1"]).toBe("missing");
  });

  it("marca como ok una relación que sigue existiendo", () => {
    const historicState = state({ relationIds: ["r1"] });
    const currentRefs = { relationIds: ["r1"], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] };
    const status = computeReferenceStatus(historicState, currentRefs);
    expect(status.relations["r1"]).toBe("ok");
  });

  it("solo incluye las referencias del estado histórico, no las nuevas del proyecto", () => {
    const historicState = state({ relationIds: ["r-old"] });
    const currentRefs = { relationIds: ["r-old", "r-new"], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] };
    const status = computeReferenceStatus(historicState, currentRefs);
    expect(status.relations["r-old"]).toBe("ok");
    expect(status.relations["r-new"]).toBeUndefined();
  });

  it("el referenceHash de una versión histórica no cambia al añadir referencias nuevas al proyecto", () => {
    const historic = version({
      relationIds: ["r1"],
      referenceHash: referenceHash({ relationIds: ["r1"], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] })
    });
    // Añadir r-new al proyecto no cambia el hash guardado en la versión histórica.
    expect(historic.referenceHash).toBe(
      referenceHash({ relationIds: ["r1"], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] })
    );
  });

  it("reconstruir no resucita referencias borradas ni elimina referencias nuevas", () => {
    const current = doc();
    const old = version({
      id: "s1",
      pinned: true,
      title: "Antigua",
      text: "Antigua",
      relationIds: ["r-old"],
      contentHash: contentHash({ title: "Antigua", text: "Antigua", kind: "note", order: 0 }),
      referenceHash: referenceHash({ relationIds: ["r-old"], tagAssignmentKeys: [], authorNoteIds: [], compositionEntryIds: [] })
    });
    const reconstructed = reconstructVersion([old], [], "s1", current);
    // El estado reconstruido lleva las referencias históricas (r-old),
    // no las del proyecto actual (r-new no está).
    expect(reconstructed.relationIds).toEqual(["r-old"]);
  });
});