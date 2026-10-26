import Database from "@tauri-apps/plugin-sql";
import type {
  DocumentRecord,
  Id,
  Project
} from "../core/model.js";
import type { ProjectStorage } from "../core/storage.js";
import type { DocumentVersion } from "../core/versions.js";

type SqlRow<T> = T;

export class SqliteProjectStorage implements ProjectStorage {
  private constructor(private readonly database: Database) {}

  static async create(): Promise<SqliteProjectStorage> {
    const database = await Database.load("sqlite:lintea.db");

    await database.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        documentUpdatedAt TEXT NOT NULL,
        label TEXT,
        note TEXT,
        FOREIGN KEY (documentId) REFERENCES documents(id),
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )
    `);

    return new SqliteProjectStorage(database);
  }

  async listProjects(): Promise<Project[]> {
    return this.database.select<Project[]>(
      "SELECT id, title, createdAt, updatedAt FROM projects ORDER BY createdAt"
    );
  }

  async getProject(projectId: Id): Promise<Project | null> {
    const rows = await this.database.select<Project[]>(
      "SELECT id, title, createdAt, updatedAt FROM projects WHERE id = ?",
      [projectId]
    );
    return rows[0] ?? null;
  }

  async createProject(project: Project): Promise<void> {
    await this.database.execute(
      "INSERT INTO projects (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      [project.id, project.title, project.createdAt, project.updatedAt]
    );
  }

  async listDocuments(projectId: Id): Promise<DocumentRecord[]> {
    return this.database.select<DocumentRecord[]>(
      `SELECT id, projectId, title, text, createdAt, updatedAt
       FROM documents WHERE projectId = ? ORDER BY createdAt`,
      [projectId]
    );
  }

  async getDocument(documentId: Id): Promise<DocumentRecord | null> {
    const rows = await this.database.select<DocumentRecord[]>(
      `SELECT id, projectId, title, text, createdAt, updatedAt
       FROM documents WHERE id = ?`,
      [documentId]
    );
    return rows[0] ?? null;
  }

  async createDocument(document: DocumentRecord): Promise<void> {
    await this.database.execute(
      `INSERT INTO documents
       (id, projectId, title, text, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        document.id,
        document.projectId,
        document.title,
        document.text,
        document.createdAt,
        document.updatedAt
      ]
    );
  }

  async updateDocument(document: DocumentRecord): Promise<void> {
    const result = await this.database.execute(
      `UPDATE documents
       SET projectId = ?, title = ?, text = ?, updatedAt = ?
       WHERE id = ?`,
      [
        document.projectId,
        document.title,
        document.text,
        document.updatedAt,
        document.id
      ]
    );

    if (result.rowsAffected === 0) {
      throw new Error("No se puede actualizar un documento que no existe.");
    }
  }

  async listDocumentVersions(documentId: Id): Promise<DocumentVersion[]> {
    return this.database.select<DocumentVersion[]>(
      `SELECT id, documentId, projectId, title, text, createdAt,
              documentUpdatedAt, label, note
       FROM document_versions
       WHERE documentId = ?
       ORDER BY createdAt DESC`,
      [documentId]
    );
  }

  async getDocumentVersion(versionId: Id): Promise<DocumentVersion | null> {
    const rows = await this.database.select<DocumentVersion[]>(
      `SELECT id, documentId, projectId, title, text, createdAt,
              documentUpdatedAt, label, note
       FROM document_versions WHERE id = ?`,
      [versionId]
    );
    return rows[0] ?? null;
  }

  async createDocumentVersion(version: DocumentVersion): Promise<void> {
    await this.database.execute(
      `INSERT INTO document_versions
       (id, documentId, projectId, title, text, createdAt,
        documentUpdatedAt, label, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.documentId,
        version.projectId,
        version.title,
        version.text,
        version.createdAt,
        version.documentUpdatedAt,
        version.label ?? null,
        version.note ?? null
      ]
    );
  }
}
