
import type { DocumentRecord, Id, Project } from "./model.js";

export interface ProjectStorage {
  listProjects(): Promise<Project[]>;

  getProject(projectId: Id): Promise<Project | null>;

  createProject(project: Project): Promise<void>;

  listDocuments(projectId: Id): Promise<DocumentRecord[]>;

  getDocument(documentId: Id): Promise<DocumentRecord | null>;

  createDocument(document: DocumentRecord): Promise<void>;

  updateDocument(document: DocumentRecord): Promise<void>;
}
