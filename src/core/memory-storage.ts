
import type { DocumentRecord, Id, Project } from "./model.js";
import type { ProjectStorage } from "./storage.js";

export class MemoryProjectStorage implements ProjectStorage {
  private readonly projects = new Map<Id, Project>();
  private readonly documents = new Map<Id, DocumentRecord>();

  async listProjects(): Promise<Project[]> {
    return [...this.projects.values()].map((project) => ({ ...project }));
  }

  async getProject(projectId: Id): Promise<Project | null> {
    const project = this.projects.get(projectId);
    return project ? { ...project } : null;
  }

  async createProject(project: Project): Promise<void> {
    if (this.projects.has(project.id)) {
      throw new Error("Ya existe un proyecto con ese identificador.");
    }

    this.projects.set(project.id, { ...project });
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
}
