
import { describe, expect, it } from "vitest";
import type { DocumentRecord } from "../src/core/model.js";
import {
  createDocumentVersion,
  restoreDocumentVersion
} from "../src/core/versions.js";

const document: DocumentRecord = {
  id: "document-1",
  projectId: "project-1",
  title: "Primer borrador",
  text: "Una idea que después descarté.",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z"
};

describe("versiones de documentos", () => {
  it("conserva una fotografía del documento", () => {
    const version = createDocumentVersion(
      document,
      { label: "Primera idea" },
      () => new Date("2026-01-02T10:00:00.000Z")
    );

    expect(version.documentId).toBe(document.id);
    expect(version.projectId).toBe(document.projectId);
    expect(version.title).toBe(document.title);
    expect(version.text).toBe(document.text);
    expect(version.label).toBe("Primera idea");
    expect(version.createdAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it("omite etiquetas y notas vacías", () => {
    const version = createDocumentVersion(document, {
      label: "   ",
      note: ""
    });

    expect(version.label).toBeUndefined();
    expect(version.note).toBeUndefined();
  });

  it("recupera una versión sin alterar el documento original", () => {
    const version = createDocumentVersion(document);

    const current: DocumentRecord = {
      ...document,
      title: "Nueva dirección",
      text: "La historia tomó otro camino.",
      updatedAt: "2026-01-03T10:00:00.000Z"
    };

    const restored = restoreDocumentVersion(
      current,
      version,
      () => new Date("2026-01-04T10:00:00.000Z")
    );

    expect(restored.title).toBe("Primer borrador");
    expect(restored.text).toBe("Una idea que después descarté.");
    expect(restored.updatedAt).toBe("2026-01-04T10:00:00.000Z");

    // El estado previo sigue intacto.
    expect(current.title).toBe("Nueva dirección");
    expect(current.text).toBe("La historia tomó otro camino.");
  });

  it("no cambia un documento que ya coincide con la versión", () => {
    const version = createDocumentVersion(document);

    const restored = restoreDocumentVersion(document, version);

    expect(restored).toBe(document);
  });

  it("rechaza recuperar una versión de otro documento", () => {
    const version = createDocumentVersion(document);
    const otherDocument = {
      ...document,
      id: "document-2"
    };

    expect(() => restoreDocumentVersion(otherDocument, version))
      .toThrow("La versión no pertenece al documento que se quiere recuperar.");
  });
});
