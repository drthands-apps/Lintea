
import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";

describe("WorkspaceService", () => {
  function createService() {
    let tick = 0;

    const now = () => new Date(
      Date.UTC(2026, 0, 1, 0, 0, tick++)
    );

    const storage = new MemoryProjectStorage();
    const service = new WorkspaceService(storage, now);

    return { storage, service };
  }

  it("crea un proyecto y permite recuperarlo", async () => {
    const { service } = createService();

    const project = await service.createProject({
      title: "Mi proyecto"
    });

    const projects = await service.listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(project);
    expect(project.title).toBe("Mi proyecto");
  });

  it("crea un documento dentro de un proyecto existente", async () => {
    const { service } = createService();

    const project = await service.createProject({
      title: "Mi proyecto"
    });

    const document = await service.createDocument({
      projectId: project.id,
      title: "Primera nota",
      text: "Una idea inicial."
    });

    expect(document.projectId).toBe(project.id);
    expect(document.title).toBe("Primera nota");
    expect(document.text).toBe("Una idea inicial.");

    const documents = await service.listDocuments(project.id);
    expect(documents).toEqual([document]);
  });

  it("rechaza crear un documento en un proyecto inexistente", async () => {
    const { service } = createService();

    await expect(
      service.createDocument({
        projectId: "proyecto-inexistente",
        title: "Documento"
      })
    ).rejects.toThrow(
      "No se puede crear un documento sin un proyecto existente."
    );
  });

  it("actualiza el título y el contenido de un documento", async () => {
    const { service } = createService();

    const project = await service.createProject({
      title: "Mi proyecto"
    });

    const document = await service.createDocument({
      projectId: project.id,
      title: "Borrador",
      text: "Texto inicial."
    });

    const updated = await service.updateDocument(document.id, {
      title: "Versión revisada",
      text: "Texto corregido."
    });

    expect(updated.title).toBe("Versión revisada");
    expect(updated.text).toBe("Texto corregido.");
    expect(updated.updatedAt).not.toBe(document.updatedAt);

    await expect(
      service.listDocuments(project.id)
    ).resolves.toEqual([updated]);
  });

  it("rechaza actualizar un documento inexistente", async () => {
    const { service } = createService();

    await expect(
      service.updateDocument("documento-inexistente", {
        text: "Texto"
      })
    ).rejects.toThrow(
      "No se puede actualizar un documento que no existe."
    );
  });

  it("no cambia la fecha si no hay modificaciones", async () => {
    const { service } = createService();

    const project = await service.createProject({
      title: "Mi proyecto"
    });

    const document = await service.createDocument({
      projectId: project.id,
      title: "Borrador",
      text: "Texto original."
    });

    const result = await service.updateDocument(document.id, {
      title: document.title,
      text: document.text
    });

    expect(result).toEqual(document);
  });
});
