import type { DocumentRecord, Id, Project } from "./model.js";
import { createId } from "./model.js";

export interface CreateProjectInput {
  title: string;
}

export interface CreateDocumentInput {
  projectId: Id;
  title: string;
  text?: string;
}

export interface ProjectWorkspace {
  projects: Project[];
  documents: DocumentRecord[];
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} no puede estar vacío.`);
  }

  return normalized;
}

function requireValidDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha proporcionada no es válida.");
  }

  return date.toISOString();
}

export function createProject(
  input: CreateProjectInput,
  now: () => Date = () => new Date()
): Project {
  const timestamp = requireValidDate(now());

  return {
    id: createId(),
    title: requireText(input.title, "El título del proyecto"),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createDocument(
  input: CreateDocumentInput,
  workspace: ProjectWorkspace,
  now: () => Date = () => new Date()
): DocumentRecord {
  const projectExists = workspace.projects.some(
    (project) => project.id === input.projectId
  );

  if (!projectExists) {
    throw new Error("No se puede crear un documento sin un proyecto existente.");
  }

  const title = requireText(input.title, "El título del documento");

  const timestamp = requireValidDate(now());

  return {
    id: createId(),
    projectId: input.projectId,
    title,
    text: input.text ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function addDocument(
  workspace: ProjectWorkspace,
  document: DocumentRecord
): ProjectWorkspace {
  if (!workspace.projects.some((project) => project.id === document.projectId)) {
    throw new Error("El proyecto del documento no existe.");
  }

  if (workspace.documents.some((item) => item.id === document.id)) {
    throw new Error("Ya existe un documento con ese identificador.");
  }

  return {
    ...workspace,
    projects: [...workspace.projects],
    documents: [...workspace.documents, document]
  };
}


export interface UpdateDocumentInput {
  title?: string;
  text?: string;
}

export function updateDocument(
  workspace: ProjectWorkspace,
  documentId: Id,
  changes: UpdateDocumentInput,
  now: () => Date = () => new Date()
): ProjectWorkspace {
  const index = workspace.documents.findIndex(
    (document) => document.id === documentId
  );

  if (index === -1) {
    throw new Error("No se puede actualizar un documento que no existe.");
  }

  const current = workspace.documents[index];

  const title =
    changes.title === undefined
      ? current.title
      : requireText(changes.title, "El título del documento");

  const text = changes.text === undefined ? current.text : changes.text;

  if (title === current.title && text === current.text) {
    return workspace;
  }

  const updatedAt = requireValidDate(now());

  const updatedDocument: DocumentRecord = {
    ...current,
    title,
    text,
    updatedAt
  };

  const documents = [...workspace.documents];
  documents[index] = updatedDocument;

  return {
    ...workspace,
    projects: [...workspace.projects],
    documents
  };
}
