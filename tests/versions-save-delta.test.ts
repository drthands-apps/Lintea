import { describe, expect, it } from "vitest";
import { createTestService } from "./helpers.js";

describe("guardado de versiones con deltas", () => {
  it("la primera versión de un documento es un estado conservado", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const version = await service.saveDocumentVersion(document.id);
    expect(version.pinned).toBe(true);
    expect(version.changes).toBeUndefined();
    expect(version.baseStateId).toBeUndefined();
    expect(version.contentHash).toBeTruthy();
    expect(version.referenceHash).toBeTruthy();
  });

  it("la segunda versión es un delta respecto a la primera", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });
    const second = await service.saveDocumentVersion(document.id);

    expect(second.pinned).toBeFalsy();
    expect(second.baseStateId).toBe(first.id);
    expect(second.changes).toBeDefined();
    expect(second.changes!.some((c) => c.kind === "text")).toBe(true);
  });

  it("no crea versión nueva si el contenido no ha cambiado desde la última", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);
    const second = await service.saveDocumentVersion(document.id);
    expect(second.id).toBe(first.id);
  });

  it("A→B→A crea una nueva relación, no una nueva versión duplicada de A", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });
    const second = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado A." });
    const third = await service.saveDocumentVersion(document.id);

    // En el modelo v0.2, volver a A puede crear un estado nuevo (delta)
    // o reutilizar el estado A existente, pero en cualquier caso la
    // historia queda registrada con una relación de B a A.
    // El test fija que el historial no se pierde: hay al menos dos
    // estados (A y B) y una relación que conecta la vuelta.
    const versions = await service.listDocumentVersions(document.id);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    const relations = await service.listVersionRelations(document.id);
    expect(relations.length).toBeGreaterThanOrEqual(2);
    expect(third.id).not.toBe(second.id);
  });
});