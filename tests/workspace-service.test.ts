
import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import { createTestService } from "./helpers.js";

describe("WorkspaceService", () => {

  it("crea un proyecto y permite recuperarlo", async () => {
    const { service } = createTestService();

    const project = await service.createProject({
      title: "Mi proyecto"
    });

    const projects = await service.listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(project);
    expect(project.title).toBe("Mi proyecto");
  });

  it("actualiza el contexto de un proyecto y conserva su fecha de creación", async () => {
  const { service } = createTestService();

  const project = await service.createProject({
    title: "Mi proyecto"
  });

  const updated = await service.updateProject(project.id, {
  context: {
    kind: "fiction",
    primaryLanguage: "es",
    additionalLanguages: ["en", "fr"],
    editorialStyle: "modern"
  }
});

  expect(updated.context).toEqual({
    kind: "fiction",
    primaryLanguage: "es",
    additionalLanguages: ["en", "fr"],
    editorialStyle: "modern"
  });

  expect(updated.createdAt).toBe(project.createdAt);
  expect(updated.updatedAt).not.toBe(project.updatedAt);

  await expect(service.listProjects()).resolves.toContainEqual(updated);
});

it("no cambia las fechas si el proyecto no se modifica", async () => {
  const { service } = createTestService();

  const project = await service.createProject({
    title: "Mi proyecto"
  });

  const result = await service.updateProject(project.id, {
    title: project.title
  });

  expect(result).toEqual(project);
  expect(result.createdAt).toBe(project.createdAt);
  expect(result.updatedAt).toBe(project.updatedAt);

  await expect(service.listProjects()).resolves.toContainEqual(project);
});

it("actualiza el título y conserva las fechas correctamente", async () => {
  const { service } = createTestService();

  const project = await service.createProject({
    title: "Mi proyecto"
  });

  const updated = await service.updateProject(project.id, {
    title: "Mi proyecto revisado"
  });

  expect(updated.title).toBe("Mi proyecto revisado");
  expect(updated.id).toBe(project.id);
  expect(updated.createdAt).toBe(project.createdAt);
  expect(updated.updatedAt).not.toBe(project.updatedAt);

  await expect(service.listProjects()).resolves.toContainEqual(updated);
});


it("rechaza actualizar un proyecto inexistente", async () => {
  const { service } = createTestService();

  await expect(
  service.updateProject("proyecto-inexistente", {
    title: "Nuevo título"
  })
).rejects.toThrow(
  "No se puede actualizar un proyecto que no existe."
);
});


  it("crea un documento dentro de un proyecto existente", async () => {
    const { service } = createTestService();

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
    const { service } = createTestService();

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
    const { service } = createTestService();

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
    const { service } = createTestService();

    await expect(
      service.updateDocument("documento-inexistente", {
        text: "Texto"
      })
    ).rejects.toThrow(
      "No se puede actualizar un documento que no existe."
    );
  });

  it("no cambia la fecha si no hay modificaciones", async () => {
    const { service } = createTestService();

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
  
  it("guarda y consulta versiones de un documento", async () => {
    const { service } = createTestService();

    const project = await service.createProject({ title: "Mi proyecto" });
    const document = await service.createDocument({
      projectId: project.id,
      title: "Borrador",
      text: "Una idea inicial."
    });

    const version = await service.saveDocumentVersion(document.id, {
      label: "Primera idea"
    });

    const versions = await service.listDocumentVersions(document.id);

    expect(versions).toHaveLength(1);
    expect(versions[0]).toEqual(version);
    expect(version.label).toBe("Primera idea");
    expect(version.text).toBe("Una idea inicial.");
  });

  it("evita versiones automáticas duplicadas del mismo contenido", async () => {
    const { service } = createTestService();

    const project = await service.createProject({ title: "Mi proyecto" });
    const document = await service.createDocument({
      projectId: project.id,
      title: "Borrador",
      text: "La misma idea."
    });

    const first = await service.saveDocumentVersion(document.id);
    const second = await service.saveDocumentVersion(document.id);

    expect(second.id).toBe(first.id);
    expect(await service.listDocumentVersions(document.id)).toHaveLength(1);
  });

  it("conserva el estado actual antes de recuperar una versión antigua", async () => {
    const { service } = createTestService();

    const project = await service.createProject({ title: "Mi proyecto" });
    const document = await service.createDocument({
      projectId: project.id,
      title: "Primera idea",
      text: "Un camino narrativo."
    });

    const firstVersion = await service.saveDocumentVersion(document.id, {
      label: "Primera idea"
    });

    await service.updateDocument(document.id, {
      title: "Nueva idea",
      text: "Un camino distinto."
    });

    const restored = await service.restoreDocumentVersion(
      document.id,
      firstVersion.id
    );

    expect(restored.title).toBe("Primera idea");
    expect(restored.text).toBe("Un camino narrativo.");

    const versions = await service.listDocumentVersions(document.id);

    expect(versions).toHaveLength(2);
    expect(versions.some(
      (version) =>
        version.title === "Nueva idea" &&
        version.text === "Un camino distinto."
    )).toBe(true);
  });

  it("rechaza recuperar una versión de otro documento", async () => {
    const { service } = createTestService();

    const project = await service.createProject({ title: "Mi proyecto" });
    const first = await service.createDocument({
      projectId: project.id,
      title: "Documento uno",
      text: "Texto uno."
    });
    const second = await service.createDocument({
      projectId: project.id,
      title: "Documento dos",
      text: "Texto dos."
    });

    const version = await service.saveDocumentVersion(first.id);

    await expect(
      service.restoreDocumentVersion(second.id, version.id)
    ).rejects.toThrow(
      "La versión solicitada no pertenece a este documento."
    );
  });
  it("no registra una tercera versión si el contenido vuelve a un estado anterior", async () => {
  const { service } = createTestService();
  const project = await service.createProject({ title: "P" });
  const document = await service.createDocument({
    projectId: project.id, title: "Borrador", text: "Estado A."
  });
  const first = await service.saveDocumentVersion(document.id);

  await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });
  await service.saveDocumentVersion(document.id);

  await service.updateDocument(document.id, { title: "Borrador", text: "Estado A." });
  const back = await service.saveDocumentVersion(document.id);

  expect(back.id).toBe(first.id);
  expect(await service.listDocumentVersions(document.id)).toHaveLength(2);
  });
  it("no registra una tercera versión si el contenido vuelve a un estado anterior", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });
    await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado A." });
    const back = await service.saveDocumentVersion(document.id);

    expect(back.id).toBe(first.id);
    expect(await service.listDocumentVersions(document.id)).toHaveLength(2);
  });
  it("rechaza URLs no válidas al crear una fuente", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    await expect(
      service.createSource({ projectId: project.id, title: "S", url: "javascript:alert(1)" })
    ).rejects.toThrow("Los enlaces externos deben usar HTTP o HTTPS.");
    await expect(
      service.createSource({ projectId: project.id, title: "S", url: "no-es-url" })
    ).rejects.toThrow("La dirección de la fuente no es válida.");
  });
  it("restaurar una versión antigua no elimina relaciones nuevas del proyecto", async () => {
  const { service } = createTestService();
  const project = await service.createProject({ title: "P" });
  const document = await service.createDocument({
    projectId: project.id, title: "Borrador", text: "Estado A."
  });
  const entityOld = await service.createKnowledgeEntity({
    projectId: project.id, kind: "concept", title: "Vieja"
  });
  const relationOld = await service.createRelation({
    projectId: project.id,
    fromId: document.id, fromType: "document",
    toId: entityOld.id, toType: "entity",
    kind: "mentions"
  });

  // Guardamos la versión con la relación antigua activa.
  const version = await service.saveDocumentVersion(document.id, { label: "Con relación antigua" });

  // Después, el usuario añade una relación nueva al documento.
  const entityNew = await service.createKnowledgeEntity({
    projectId: project.id, kind: "concept", title: "Nueva"
  });
  const relationNew = await service.createRelation({
    projectId: project.id,
    fromId: document.id, fromType: "document",
    toId: entityNew.id, toType: "entity",
    kind: "mentions"
  });

  // Restaurar la versión antigua no debe eliminar la relación nueva.
  await service.restoreDocumentVersion(document.id, version.id);

  const relations = await service.listRelations(project.id);
  expect(relations.map((r) => r.id).sort()).toEqual(
    [relationOld.id, relationNew.id].sort()
  );
});
});
