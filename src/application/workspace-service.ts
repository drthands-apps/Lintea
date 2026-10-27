
import type { DocumentRecord, Id, Project } from "../core/model.js";
import {
  createDocument as buildDocument,
  createProject as buildProject,
  updateDocument as applyDocumentUpdate,
  updateProject as applyProjectUpdate
} from "../core/projects.js";
import type {
  CreateDocumentInput,
  CreateProjectInput,
  UpdateDocumentInput,
  UpdateProjectInput
} from "../core/projects.js";
import {
  createDocumentVersion as buildVersion,
  restoreDocumentVersion as buildRestoredDocument
} from "../core/versions.js";
import type {
  CreateVersionInput,
  DocumentVersion
} from "../core/versions.js";
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

  async updateProject(
  projectId: Id,
  changes: UpdateProjectInput
): Promise<Project> {
  const current = await this.storage.getProject(projectId);

  if (!current) {
    throw new Error("No se puede actualizar un proyecto que no existe.");
  }

  const projects = applyProjectUpdate(
    [current],
    projectId,
    changes,
    this.now
  );

  const updated = projects[0];

  if (!updated) {
    throw new Error("No se pudo obtener el proyecto actualizado.");
  }

  if (updated === current) {
    return current;
  }

  await this.storage.updateProject(updated);

  return updated;
}

  listDocuments(projectId: Id): Promise<DocumentRecord[]> {
    return this.storage.listDocuments(projectId);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
    const project = await this.storage.getProject(input.projectId);

    if (!project) {
      throw new Error("No se puede crear un documento sin un proyecto existente.");
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
      throw new Error("No se puede actualizar un documento que no existe.");
    }

    const workspace = applyDocumentUpdate(
      { projects: [], documents: [current] },
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

  /**
   * Crea un punto de recuperación.
   *
   * Si el contenido coincide con la versión más reciente y no se ha
   * solicitado una etiqueta o nota, evita guardar una copia redundante.
   */
  async saveDocumentVersion(
    documentId: Id,
    input: CreateVersionInput = {}
  ): Promise<DocumentVersion> {
    const document = await this.storage.getDocument(documentId);

    if (!document) {
      throw new Error("No se puede versionar un documento que no existe.");
    }

    const versions = await this.storage.listDocumentVersions(documentId);
    const latest = versions[0];
    const hasDescription = Boolean(input.label?.trim() || input.note?.trim());

    if (
      latest &&
      !hasDescription &&
      latest.title === document.title &&
      latest.text === document.text
    ) {
      return latest;
    }

    const version = buildVersion(document, input, this.now);
    await this.storage.createDocumentVersion(version);

    return version;
  }

  listDocumentVersions(documentId: Id): Promise<DocumentVersion[]> {
    return this.storage.listDocumentVersions(documentId);
  }

  /**
   * Recupera una versión sin perder el estado que estaba activo.
   * Conserva primero el estado actual si su contenido es diferente.
   */
  async restoreDocumentVersion(
    documentId: Id,
    versionId: Id
  ): Promise<DocumentRecord> {
    const current = await this.storage.getDocument(documentId);

    if (!current) {
      throw new Error("No se puede recuperar un documento que no existe.");
    }

    const version = await this.storage.getDocumentVersion(versionId);

    if (!version || version.documentId !== documentId) {
      throw new Error("La versión solicitada no pertenece a este documento.");
    }

    if (current.title === version.title && current.text === version.text) {
      return current;
    }

    // Guardar el estado actual antes de sustituirlo.
    await this.saveDocumentVersion(documentId);

    const restored = buildRestoredDocument(current, version, this.now);
    await this.storage.updateDocument(restored);

    return restored;
  }
}
