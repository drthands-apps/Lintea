
import { describe, expect, it } from "vitest";
import {
  addDocument,
  createDocument,
  createProject,
  updateDocument,
  updateProject
} from "../src/core/projects.js";

import type { ProjectWorkspace } from "../src/core/projects.js";

const fixedDate = new Date("2026-01-15T10:00:00.000Z");
const fixedClock = () => new Date(fixedDate);

function createWorkspace(): ProjectWorkspace {
  return {
    projects: [
      {
        id: "project-1",
        title: "Mi novela",
        createdAt: fixedDate.toISOString(),
        updatedAt: fixedDate.toISOString()
      }
    ],
    documents: []
  };
}

describe("operaciones de proyectos", () => {
  it("crea un proyecto con título y fechas", () => {
    const project = createProject(
      { title: "  Mi investigación  " },
      fixedClock
    );

    expect(project.title).toBe("Mi investigación");
    expect(project.id).toBeTruthy();
    expect(project.createdAt).toBe(fixedDate.toISOString());
    expect(project.updatedAt).toBe(project.createdAt);
  });

  it("rechaza un título de proyecto vacío", () => {
    expect(() => createProject({ title: "   " }, fixedClock))
      .toThrow("El título del proyecto no puede estar vacío.");
  });

  it("crea un documento asociado a un proyecto existente", () => {
    const workspace = createWorkspace();

    const document = createDocument(
      {
        projectId: "project-1",
        title: "  Capítulo uno  ",
        text: "La historia comienza aquí."
      },
      workspace,
      fixedClock
    );

    expect(document.title).toBe("Capítulo uno");
    expect(document.projectId).toBe("project-1");
    expect(document.text).toBe("La historia comienza aquí.");
    expect(document.createdAt).toBe(fixedDate.toISOString());
  });

  it("rechaza documentos cuyo proyecto no existe", () => {
    expect(() =>
      createDocument(
        {
          projectId: "missing-project",
          title: "Documento"
        },
        createWorkspace(),
        fixedClock
      )
    ).toThrow("No se puede crear un documento sin un proyecto existente.");
  });

  it("añade un documento sin modificar el espacio de trabajo original", () => {
    const workspace = createWorkspace();

    const document = createDocument(
      {
        projectId: "project-1",
        title: "Notas"
      },
      workspace,
      fixedClock
    );

    const updatedWorkspace = addDocument(workspace, document);

    expect(updatedWorkspace.documents).toHaveLength(1);
    expect(workspace.documents).toHaveLength(0);
    expect(updatedWorkspace.projects).not.toBe(workspace.projects);
  });

  it("rechaza identificadores de documento duplicados", () => {
    const workspace = createWorkspace();

    const document = createDocument(
      {
        projectId: "project-1",
        title: "Notas"
      },
      workspace,
      fixedClock
    );

    const updatedWorkspace = addDocument(workspace, document);

    expect(() => addDocument(updatedWorkspace, document))
      .toThrow("Ya existe un documento con ese identificador.");
  });
});


describe("actualización de documentos", () => {
  function workspaceWithDocument(): ProjectWorkspace {
    const workspace = createWorkspace();

    const document = createDocument(
      {
        projectId: "project-1",
        title: "Borrador",
        text: "Texto original"
      },
      workspace,
      fixedClock
    );

    return addDocument(workspace, document);
  }

  describe("actualización de proyectos", () => {
  it("actualiza el contexto y conserva la identidad y fecha de creación", () => {
    const workspace = createWorkspace();
    const original = workspace.projects[0];
    const laterDate = new Date("2026-01-16T12:00:00.000Z");

    const updatedProjects = updateProject(
      workspace.projects,
      original.id,
      {
        context: {
          kind: "fiction",
          primaryLanguage: "es",
          additionalLanguages: ["en", "fr"],
          editorialStyle: "modern"
        }
      },
      () => new Date(laterDate)
    );

    const updated = updatedProjects[0];

    expect(updated.context).toEqual({
      kind: "fiction",
      primaryLanguage: "es",
      additionalLanguages: ["en", "fr"],
      editorialStyle: "modern"
    });
    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe(laterDate.toISOString());
    expect(original.context).toBeUndefined();
  });

  it("no cambia las fechas si el proyecto no cambia", () => {
    const workspace = createWorkspace();
    const original = workspace.projects[0];

    const result = updateProject(
      workspace.projects,
      original.id,
      { title: original.title },
      () => new Date("2026-02-01T00:00:00.000Z")
    );

    expect(result).toBe(workspace.projects);
    expect(result[0].createdAt).toBe(original.createdAt);
    expect(result[0].updatedAt).toBe(original.updatedAt);
  });

  it("rechaza un título vacío", () => {
    const workspace = createWorkspace();

    expect(() =>
      updateProject(
        workspace.projects,
        "project-1",
        { title: "   " },
        fixedClock
      )
    ).toThrow("El título del proyecto no puede estar vacío.");
  });

  it("rechaza un proyecto inexistente", () => {
    expect(() =>
      updateProject(
        createWorkspace().projects,
        "missing-project",
        { title: "Nuevo título" },
        fixedClock
      )
    ).toThrow("No se puede actualizar un proyecto que no existe.");
  });
});

  it("actualiza el texto y la fecha sin cambiar la identidad", () => {
    const workspace = workspaceWithDocument();
    const original = workspace.documents[0];
    const laterDate = new Date("2026-01-16T12:00:00.000Z");

    const updated = updateDocument(
      workspace,
      original.id,
      { text: "Texto revisado" },
      () => new Date(laterDate)
    );

    const result = updated.documents[0];

    expect(result.text).toBe("Texto revisado");
    expect(result.id).toBe(original.id);
    expect(result.projectId).toBe(original.projectId);
    expect(result.createdAt).toBe(original.createdAt);
    expect(result.updatedAt).toBe(laterDate.toISOString());
    expect(workspace.documents[0].text).toBe("Texto original");
  });

  it("rechaza un título vacío", () => {
    const workspace = workspaceWithDocument();
    const document = workspace.documents[0];

    expect(() =>
      updateDocument(workspace, document.id, { title: "   " }, fixedClock)
    ).toThrow("El título del documento no puede estar vacío.");
  });

  it("rechaza un documento inexistente", () => {
    expect(() =>
      updateDocument(
        createWorkspace(),
        "missing-document",
        { text: "Nuevo texto" },
        fixedClock
      )
    ).toThrow("No se puede actualizar un documento que no existe.");
  });

  it("no cambia la fecha si el contenido no cambia", () => {
    const workspace = workspaceWithDocument();
    const document = workspace.documents[0];

    const result = updateDocument(
      workspace,
      document.id,
      { text: document.text },
      () => new Date("2026-02-01T00:00:00.000Z")
    );

    expect(result).toBe(workspace);
    expect(result.documents[0].updatedAt).toBe(document.updatedAt);
  });
});

