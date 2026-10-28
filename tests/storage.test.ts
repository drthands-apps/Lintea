
import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import type { DocumentRecord, Project } from "../src/core/model.js";

const project: Project = {
  id: "project-1",
  title: "Mi novela",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z"
};

const document: DocumentRecord = {
  id: "document-1",
  projectId: "project-1",
  title: "Capítulo uno",
  text: "La historia comienza.",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z"
};

describe("MemoryProjectStorage", () => {
  it("guarda y recupera proyectos", async () => {
    const storage = new MemoryProjectStorage();

    await storage.createProject(project);

    expect(await storage.getProject(project.id)).toEqual(project);
    expect(await storage.listProjects()).toEqual([project]);
  });

  it("rechaza proyectos con identificadores duplicados", async () => {
    const storage = new MemoryProjectStorage();

    await storage.createProject(project);

    await expect(storage.createProject(project))
      .rejects.toThrow("Ya existe un proyecto con ese identificador.");
  });

  it("guarda y recupera documentos de un proyecto", async () => {
    const storage = new MemoryProjectStorage();

    await storage.createProject(project);
    await storage.createDocument(document);

    expect(await storage.getDocument(document.id)).toEqual(document);
    expect(await storage.listDocuments(project.id)).toEqual([document]);
  });

  it("aísla el contexto de los proyectos recuperados", async () => {
  const storage = new MemoryProjectStorage();

  const projectWithContext: Project = {
    ...project,
    context: {
      kind: "fiction",
      primaryLanguage: "es",
      additionalLanguages: ["en"],
      editorialStyle: "classic"
    }
  };

  await storage.createProject(projectWithContext);

  const recovered = await storage.getProject(project.id);

  if (!recovered?.context) {
    throw new Error("El proyecto debería tener contexto.");
  }

  recovered.context.additionalLanguages.push("fr");

  const saved = await storage.getProject(project.id);

  expect(saved?.context?.additionalLanguages).toEqual(["en"]);
});

  it("rechaza documentos cuyo proyecto no existe", async () => {
    const storage = new MemoryProjectStorage();

    await expect(
      storage.createDocument({
        ...document,
        projectId: "missing-project"
      })
    ).rejects.toThrow("El proyecto del documento no existe.");
  });

  it("actualiza un documento existente", async () => {
    const storage = new MemoryProjectStorage();

    await storage.createProject(project);
    await storage.createDocument(document);

    const updated: DocumentRecord = {
      ...document,
      text: "La historia ha cambiado.",
      updatedAt: "2026-01-02T10:00:00.000Z"
    };

    await storage.updateDocument(updated);

    expect(await storage.getDocument(document.id)).toEqual(updated);
  });
  it("rechaza reordenar con un ID que no pertenece al capítulo", async () => {
  const storage = new MemoryProjectStorage();
  const project = { id: "p", title: "P", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  await storage.createProject(project);
  const chapterA = { id: "a", projectId: "p", title: "A", text: "", kind: "chapter" as const, order: 0, createdAt: project.createdAt, updatedAt: project.updatedAt };
  const chapterB = { id: "b", projectId: "p", title: "B", text: "", kind: "chapter" as const, order: 1, createdAt: project.createdAt, updatedAt: project.updatedAt };
  const fragment = { id: "f", projectId: "p", title: "F", text: "", kind: "fragment" as const, order: 0, createdAt: project.createdAt, updatedAt: project.updatedAt };
  await storage.createDocument(chapterA);
  await storage.createDocument(chapterB);
  await storage.createDocument(fragment);
  await storage.createCompositionEntry({ id: "e1", projectId: "p", chapterId: "a", fragmentId: "f", order: 0, createdAt: project.createdAt });
  await expect(
    storage.reorderCompositionEntries("a", ["e1", "id-ajeno"])
  ).rejects.toThrow("El nuevo orden debe incluir cada pieza del capítulo exactamente una vez.");
});

});

