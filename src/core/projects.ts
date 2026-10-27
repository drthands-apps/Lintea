
import type {
  DocumentRecord,
  DocumentKind,
  Id,
  Project,
  ProjectContext
} from "./model.js";
import { createId } from "./model.js";

export interface CreateProjectInput {
  title: string;
  context?: ProjectContext;
}
export interface CreateDocumentInput {
  projectId: Id;
  title: string;
  text?: string;
  kind?: DocumentKind;
  order?: number;
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

function copyProjectContext(context?: ProjectContext): ProjectContext {
  if (!context) {
    return {
      kind: "other",
      primaryLanguage: "und",
      additionalLanguages: [],
      editorialStyle: "classic"
    };
  }

  const primaryLanguage = requireText(
    context.primaryLanguage,
    "El idioma principal"
  );

  return {
    ...context,
    primaryLanguage,
    additionalLanguages: context.additionalLanguages.map((language) =>
      requireText(language, "El idioma adicional")
    )
  };
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
    updatedAt: timestamp,
    context: copyProjectContext(input.context)
  };
}

export interface UpdateProjectInput {
  title?: string;
  context?: ProjectContext;
}

export function updateProject(
  projects: Project[],
  projectId: Id,
  changes: UpdateProjectInput,
  now: () => Date = () => new Date()
): Project[] {
  const index = projects.findIndex(
    (project) => project.id === projectId
  );

  if (index === -1) {
    throw new Error("No se puede actualizar un proyecto que no existe.");
  }

  const current = projects[index];

  const title =
    changes.title === undefined
      ? current.title
      : requireText(changes.title, "El título del proyecto");

  const context =
    changes.context === undefined
      ? copyProjectContext(current.context)
      : copyProjectContext(changes.context);

  const currentContext = copyProjectContext(current.context);

const sameContext =
  context.kind === currentContext.kind &&
  context.primaryLanguage === currentContext.primaryLanguage &&
  context.editorialStyle === currentContext.editorialStyle &&
  context.additionalLanguages.length ===
    currentContext.additionalLanguages.length &&
  context.additionalLanguages.every(
    (language, index) =>
      language === currentContext.additionalLanguages[index]
  );

  if (title === current.title && sameContext) {
    return projects;
  }

  const updatedAt = requireValidDate(now());

  const updatedProject: Project = {
    ...current,
    title,
    context,
    updatedAt
  };

  const updatedProjects = [...projects];
  updatedProjects[index] = updatedProject;

  return updatedProjects;
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
    kind: input.kind ?? "note",
    order: input.order ?? 0,
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
  kind?: DocumentKind;
  order?: number;
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
  const kind = changes.kind === undefined ? current.kind ?? "note" : changes.kind;
  const order = changes.order === undefined ? current.order ?? 0 : changes.order;

  if (title === current.title && text === current.text && kind === (current.kind ?? "note") && order === (current.order ?? 0)) {
    return workspace;
  }

  const updatedAt = requireValidDate(now());

  const updatedDocument: DocumentRecord = {
    ...current,
    title,
    text,
    kind,
    order,
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
