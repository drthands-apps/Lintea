
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
});

