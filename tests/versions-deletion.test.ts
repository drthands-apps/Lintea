import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "../src/core/versions.js";
import { canDeleteVersion } from "../src/core/versions.js";

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

describe("borrado seguro de versiones", () => {
  it("permite borrar una versión sin hijos", () => {
    const versions = [version({ id: "v1" }), version({ id: "v2", parentVersionId: "v1" })];
    expect(canDeleteVersion(versions, "v2").allowed).toBe(true);
  });

  it("rechaza borrar una versión con hijos y nombra a los dependientes por etiqueta y fecha", () => {
    const versions = [
      version({ id: "v1" }),
      version({ id: "v2", parentVersionId: "v1", label: "Revisión del capítulo 3", createdAt: "2026-03-18T00:00:00.000Z" })
    ];
    const result = canDeleteVersion(versions, "v1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Revisión del capítulo 3/);
    expect(result.reason).toMatch(/18 mar 2026|2026-03-18/);
    expect(result.blockingVersions.map((v) => v.id)).toEqual(["v2"]);
  });

  it("permite borrar la última versión de la cadena", () => {
    const versions = [version({ id: "v1" }), version({ id: "v2", parentVersionId: "v1" })];
    expect(canDeleteVersion(versions, "v2").allowed).toBe(true);
  });

  it("rechaza borrar una versión que no existe", () => {
    expect(canDeleteVersion([], "no-existe").allowed).toBe(false);
  });
});