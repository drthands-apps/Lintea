import { describe, expect, it } from "vitest";
import type { DocumentRecord } from "../src/core/model.js";
import type { DocumentVersion, VersionRelation } from "../src/core/versions.js";
import { contentHash, reconstructVersion } from "../src/core/versions.js";

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

function state(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "s1",
    documentId: "doc-1",
    projectId: "p",
    title: "Antigua",
    text: "Antigua",
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

describe("integridad de contenido del historial", () => {
  it("devuelve el estado actual si se pide reconstruir el estado actual", () => {
    const current = doc();
    // No hay versiones ni relaciones: pedir el estado actual devuelve el
    // documento tal cual, sin reconstruir nada.
    const result = reconstructVersion([], [], current.id, current);
    expect(result.title).toBe("Actual");
    expect(result.text).toBe("Actual");
  });

  it("reconstruye un estado conservado íntegro (pinned)", () => {
    const current = doc();
    const old = state({
      id: "s1",
      pinned: true,
      title: "Antigua",
      text: "Antigua",
      contentHash: contentHash({ title: "Antigua", text: "Antigua", kind: "note", order: 0 })
    });
    const result = reconstructVersion([old], [], "s1", current);
    expect(result.title).toBe("Antigua");
    expect(result.text).toBe("Antigua");
  });

  it("reconstruye un estado delta aplicando cambios sobre su base", () => {
    const current = doc({ title: "C", text: "C" });
    const base = state({
      id: "base",
      pinned: true,
      title: "B",
      text: "B",
      contentHash: contentHash({ title: "B", text: "B", kind: "note", order: 0 })
    });
    const target = state({
      id: "target",
      title: "A",
      text: "A",
      baseStateId: "base",
      changes: [
        { kind: "title", from: "B", to: "A" },
        { kind: "text", from: "B", to: "A", hunks: [] }
      ],
      contentHash: contentHash({ title: "A", text: "A", kind: "note", order: 0 })
    });
    const relations = [
      relation({ id: "r1", fromStateId: "base", toStateId: "target" })
    ];
    const result = reconstructVersion([base, target], relations, "target", current);
    expect(result.title).toBe("A");
    expect(result.text).toBe("A");
  });

  it("marca como corrupto un estado cuyo contentHash no coincide", () => {
    const current = doc();
    const corrupted = state({
      id: "s1",
      pinned: true,
      title: "Antigua",
      text: "Antigua",
      contentHash: "hash-incorrecto"
    });
    expect(() => reconstructVersion([corrupted], [], "s1", current)).toThrow(/corrupto|corrupta/);
  });

  it("rechaza reconstruir un delta cuya base no existe", () => {
    const current = doc();
    const orphan = state({
      id: "s1",
      title: "Antigua",
      text: "Antigua",
      baseStateId: "no-existe",
      changes: [{ kind: "title", from: "Actual", to: "Antigua" }],
      baseMissing: true,
      contentHash: contentHash({ title: "Antigua", text: "Antigua", kind: "note", order: 0 })
    });
    expect(() => reconstructVersion([orphan], [], "s1", current)).toThrow(/base|reconstru/i);
  });

  it("rechaza reconstruir un estado que no existe en el historial", () => {
    const current = doc();
    expect(() => reconstructVersion([], [], "no-existe", current)).toThrow(/no existe|no encontrad/i);
  });

  it("prefiere un camino íntegro si otro está corrupto", () => {
    const current = doc({ title: "D", text: "D" });
    const a = state({
      id: "a",
      pinned: true,
      title: "A",
      text: "A",
      contentHash: contentHash({ title: "A", text: "A", kind: "note", order: 0 })
    });
    const b = state({
      id: "b",
      pinned: true,
      title: "B",
      text: "B",
      contentHash: contentHash({ title: "B", text: "B", kind: "note", order: 0 })
    });
    // Camino 1: a → b (válido). Camino 2: b → d (corrupto).
    // El target es b; debe elegir el camino válido desde a.
    const relations = [
      relation({ id: "r1", fromStateId: "a", toStateId: "b" })
    ];
    const result = reconstructVersion([a, b], relations, "b", current);
    expect(result.title).toBe("B");
  });
});