
import type { DocumentRecord, Id, Project } from "./model.js";
import type { DocumentVersion } from "./versions.js";

export interface ProjectStorage {
  listProjects(): Promise<Project[]>;

  getProject(projectId: Id): Promise<Project | null>;

  createProject(project: Project): Promise<void>;

  updateProject(project: Project): Promise<void>;

  listDocuments(projectId: Id): Promise<DocumentRecord[]>;

  getDocument(documentId: Id): Promise<DocumentRecord | null>;

  createDocument(document: DocumentRecord): Promise<void>;

  updateDocument(document: DocumentRecord): Promise<void>;

  listDocumentVersions(documentId: Id): Promise<DocumentVersion[]>;

  getDocumentVersion(versionId: Id): Promise<DocumentVersion | null>;

  createDocumentVersion(version: DocumentVersion): Promise<void>;
}
