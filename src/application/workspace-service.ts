
import type { DocumentRecord, Id, Project } from "../core/model.js";
import {
  createDocument as buildDocument,
  createProject as buildProject,
  updateDocument as applyDocumentUpdate
} from "../core/projects.js";
import type {
  CreateDocumentInput,
  CreateProjectInput,
  UpdateDocumentInput
} from "../core/projects.js";
import type { ProjectStorage } from "../core/storage.js";

/**
 * Coordina las operaciones de Lintea con el almacenamiento.
 * No depende de React ni de un proveedor de almacenamiento concreto.
 */
export class WorkspaceService {
  constructor(
    private readonly storage: ProjectStorage,
    private readonly now: () => Date = () => new Date()
  ) {}

  listProjects(): Promise<Project[]> {
    return this.storage.listProjects();
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const project = buildProject(input, this.now);
    await this.storage.createProject(project);
    return project;
  }

  listDocuments(projectId: Id): Promise<DocumentRecord[]> {
    return this.storage.listDocuments(projectId);
  }

  async createDocument(
    input: CreateDocumentInput
  ): Promise<DocumentRecord> {
    const project = await this.storage.getProject(input.projectId);

    if (!project) {
      throw new Error(
        "No se puede crear un documento sin un proyecto existente."
      );
    }

    const document = buildDocument(
      input,
      { projects: [project], documents: [] },
      this.now
    );

    await this.storage.createDocument(document);
    return document;
  }

  async updateDocument(
    documentId: Id,
    changes: UpdateDocumentInput
  ): Promise<DocumentRecord> {
    const current = await this.storage.getDocument(documentId);

    if (!current) {
      throw new Error(
        "No se puede actualizar un documento que no existe."
      );
    }

    const workspace = applyDocumentUpdate(
      {
        projects: [],
        documents: [current]
      },
      documentId,
      changes,
      this.now
    );

    const updated = workspace.documents[0];

    if (!updated) {
      throw new Error("No se pudo actualizar el documento.");
    }

    if (updated !== current) {
      await this.storage.updateDocument(updated);
    }

    return updated;
  }
}
