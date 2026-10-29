import { describe, expect, it } from "vitest";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";
import { canDeleteVersion } from "../src/core/versions.js";

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

describe("borrado seguro de estados del historial", () => {
  it("permite borrar un estado sin relaciones activas", () => {
    const versions = [state({ id: "s1" })];
    const result = canDeleteVersion(versions, [], "s1");
    expect(result.allowed).toBe(true);
  });

  it("rechaza borrar un estado con relaciones activas y nombra las relaciones", () => {
    const versions = [state({ id: "s1" }), state({ id: "s2" })];
    const relations = [
      relation({
        id: "r1",
        fromStateId: "s1",
        toStateId: "s2",
        label: "Revisión del capítulo 3",
        capturedAt: "2026-03-18T00:00:00.000Z"
      })
    ];
    const result = canDeleteVersion(versions, relations, "s1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Revisión del capítulo 3/);
    expect(result.reason).toMatch(/18 mar 2026|2026-03-18/);
    expect(result.blockingRelations.map((r) => r.id)).toEqual(["r1"]);
  });

  it("permite borrar un estado cuyas relaciones ya están interrumpidas", () => {
    const versions = [state({ id: "s1" })];
    const relations = [
      relation({
        id: "r1",
        fromStateId: "s1",
        toStateId: "s2",
        toMissing: true
      })
    ];
    // La relación ya está interrumpida por el otro extremo; borrar s1
    // solo la marca como fromMissing, no destruye nada vivo.
    const result = canDeleteVersion(versions, relations, "s1");
    expect(result.allowed).toBe(true);
  });

  it("rechaza borrar un estado que no existe", () => {
    const result = canDeleteVersion([], [], "no-existe");
    expect(result.allowed).toBe(false);
  });

  it("no bloquea por relaciones marcadas como rechazadas", () => {
    const versions = [state({ id: "s1" }), state({ id: "s2" })];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2", rejected: true })
    ];
    const result = canDeleteVersion(versions, relations, "s1");
    expect(result.allowed).toBe(true);
  });

  it("bloquea si hay varias relaciones activas y las nombra todas", () => {
    const versions = [
      state({ id: "s1" }),
      state({ id: "s2" }),
      state({ id: "s3" })
    ];
    const relations = [
      relation({ id: "r1", fromStateId: "s1", toStateId: "s2", label: "Primera" }),
      relation({ id: "r2", fromStateId: "s3", toStateId: "s1", label: "Segunda" })
    ];
    const result = canDeleteVersion(versions, relations, "s1");
    expect(result.allowed).toBe(false);
    expect(result.blockingRelations.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(result.reason).toMatch(/Primera/);
    expect(result.reason).toMatch(/Segunda/);
  });
});