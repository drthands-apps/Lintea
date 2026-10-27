
import type {
  DocumentRecord,
  Id,
  Project
} from "./model.js";
import type { DocumentVersion } from "./versions.js";
import type { ProjectStorage } from "./storage.js";

function copyProject(project: Project): Project {
  return {
    ...project,
    context: project.context
      ? {
          ...project.context,
          additionalLanguages: [
            ...project.context.additionalLanguages
          ]
        }
      : undefined
  };
}

export class MemoryProjectStorage implements ProjectStorage {
  private readonly projects = new Map<Id, Project>();
  private readonly documents = new Map<Id, DocumentRecord>();
  private readonly versions = new Map<Id, DocumentVersion>();

  async listProjects(): Promise<Project[]> {
  return [...this.projects.values()].map(copyProject);
}

  async getProject(projectId: Id): Promise<Project | null> {
  const project = this.projects.get(projectId);
  return project ? copyProject(project) : null;
}

  async createProject(project: Project): Promise<void> {
    if (this.projects.has(project.id)) {
      throw new Error("Ya existe un proyecto con ese identificador.");
    }

    this.projects.set(project.id, copyProject(project));
  }

  async updateProject(project: Project): Promise<void> {
  if (!this.projects.has(project.id)) {
    throw new Error("No se puede actualizar un proyecto que no existe.");
  }

  this.projects.set(project.id, copyProject(project));
}

async listDocuments(projectId: Id): Promise<DocumentRecord[]> {
    return [...this.documents.values()]
      .filter((document) => document.projectId === projectId)
      .map((document) => ({ ...document }));
  }

  async getDocument(documentId: Id): Promise<DocumentRecord | null> {
    const document = this.documents.get(documentId);
    return document ? { ...document } : null;
  }

  async createDocument(document: DocumentRecord): Promise<void> {
    if (this.documents.has(document.id)) {
      throw new Error("Ya existe un documento con ese identificador.");
    }

    if (!this.projects.has(document.projectId)) {
      throw new Error("El proyecto del documento no existe.");
    }

    this.documents.set(document.id, { ...document });
  }

  async updateDocument(document: DocumentRecord): Promise<void> {
    if (!this.documents.has(document.id)) {
      throw new Error("No se puede actualizar un documento que no existe.");
    }

    if (!this.projects.has(document.projectId)) {
      throw new Error("El proyecto del documento no existe.");
    }

    this.documents.set(document.id, { ...document });
  }

  async listDocumentVersions(documentId: Id): Promise<DocumentVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((version) => ({ ...version }));
  }

  async getDocumentVersion(versionId: Id): Promise<DocumentVersion | null> {
    const version = this.versions.get(versionId);
    return version ? { ...version } : null;
  }

  async createDocumentVersion(version: DocumentVersion): Promise<void> {
    if (this.versions.has(version.id)) {
      throw new Error("Ya existe una versión con ese identificador.");
    }

    const document = this.documents.get(version.documentId);

    if (!document) {
      throw new Error("El documento de la versión no existe.");
    }

    if (document.projectId !== version.projectId) {
      throw new Error("El proyecto de la versión no coincide con el documento.");
    }

    this.versions.set(version.id, { ...version });
  }
}
