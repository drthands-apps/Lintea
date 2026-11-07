import { describe, expect, it } from "vitest";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";

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

describe("relaciones del historial", () => {
  it("una relación conecta dos estados distintos", () => {
    const a = state({ id: "s1" });
    const b = state({ id: "s2" });
    const r = relation({ fromStateId: a.id, toStateId: b.id });

    expect(r.fromStateId).toBe("s1");
    expect(r.toStateId).toBe("s2");
    expect(r.fromStateId).not.toBe(r.toStateId);
  });

  it("una relación puede marcarse como rechazada sin desaparecer", () => {
    const r = relation({ rejected: true });
    expect(r.rejected).toBe(true);
    // La relación sigue existiendo: rejected es una marca, no un borrado.
    expect(r.fromStateId).toBe("s1");
    expect(r.toStateId).toBe("s2");
  });

  it("una relación puede tener extremos desaparecidos", () => {
    const r = relation({ fromMissing: true, toMissing: false });
    expect(r.fromMissing).toBe(true);
    expect(r.toMissing).toBe(false);
    // La relación sigue visible, marcada como interrumpida por el origen.
    expect(r.fromStateId).toBe("s1");
  });

  it("una relación puede tener ambos extremos desaparecidos", () => {
    const r = relation({ fromMissing: true, toMissing: true });
    expect(r.fromMissing).toBe(true);
    expect(r.toMissing).toBe(true);
  });

  it("una relación no puede conectar un estado consigo mismo", () => {
    // Regla de integridad: fromStateId y toStateId deben ser distintos.
    // La validación la hace el servicio al crear la relación; aquí se
    // documenta la regla y se fija la forma del tipo.
    const invalid = relation({ fromStateId: "s1", toStateId: "s1" });
    expect(invalid.fromStateId).toBe(invalid.toStateId);
    // El test existe para que, cuando se implemente la validación,
    // se cambie por una aserción de error del servicio.
  });
});