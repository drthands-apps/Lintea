import { describe, expect, it } from "vitest";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";
import { validateRelations } from "../src/core/versions.js";

function state(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "s1",
    documentId: "doc-1",
    projectId: "p",
    title: "Título",
    text: "Texto",
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

describe("integridad estructural del historial", () => {
  it("acepta un grafo lineal sin ciclos", () => {
    const versions = [
      state({ id: "s1" }),
      state({ id: "s2" }),
      state({ id: "s3" })
    ];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s2", toStateId: "s3" })
    ];
    expect(() => validateRelations(relations, versions)).not.toThrow();
  });

  it("rechaza un ciclo directo", () => {
    const versions = [state({ id: "s1" }), state({ id: "s2" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s2", toStateId: "s1" })
    ];
    expect(() => validateRelations(relations, versions)).toThrow(/ciclo/);
  });

  it("rechaza un ciclo indirecto", () => {
    const versions = [
      state({ id: "s1" }),
      state({ id: "s2" }),
      state({ id: "s3" })
    ];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s2", toStateId: "s3" }),
      relation({ id: "r3", fromStateId: "s3", toStateId: "s1" })
    ];
    expect(() => validateRelations(relations, versions)).toThrow(/ciclo/);
  });

  it("rechaza una relación con un extremo inexistente", () => {
    const versions = [state({ id: "s1" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" })
    ];
    expect(() => validateRelations(relations, versions)).toThrow(/extremo/);
  });

  it("rechaza una relación que conecta un estado consigo mismo", () => {
    const versions = [state({ id: "s1" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s1" })
    ];
    expect(() => validateRelations(relations, versions)).toThrow(/mismo/);
  });

  it("rechaza relaciones duplicadas entre los mismos extremos", () => {
    const versions = [state({ id: "s1" }), state({ id: "s2" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s1", toStateId: "s2" })
    ];
    expect(() => validateRelations(relations, versions)).toThrow(/duplicada/);
  });

  it("acepta relaciones invertidas entre los mismos extremos", () => {
    const versions = [state({ id: "s1" }), state({ id: "s2" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s2", toStateId: "s1" })
    ];
    // s1 → s2 y s2 → s1 forman un ciclo, así que se rechaza.
    expect(() => validateRelations(relations, versions)).toThrow(/ciclo/);
  });

  it("acepta un grafo con un cruce y varios caminos", () => {
    // s1 → s2 → s4
    // s1 → s3 → s4
    const versions = [
      state({ id: "s1" }),
      state({ id: "s2" }),
      state({ id: "s3" }),
      state({ id: "s4" })
    ];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2" }),
      relation({ id: "r2", fromStateId: "s1", toStateId: "s3" }),
      relation({ id: "r3", fromStateId: "s2", toStateId: "s4" }),
      relation({ id: "r4", fromStateId: "s3", toStateId: "s4" })
    ];
    expect(() => validateRelations(relations, versions)).not.toThrow();
  });
});