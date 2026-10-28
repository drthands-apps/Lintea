import Database from "@tauri-apps/plugin-sql";
import type {
  DocumentRecord,
  Id,
  Project,
  KnowledgeEntity,
  SourceRecord,
  Relation,
  CompositionEntry,
  AuthorNote,
  Tag,
  TagAssignment
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
    const projectColumns = await database.select<{ name: string }[]>(
  "PRAGMA table_info(projects)"
);

if (!projectColumns.some((column) => column.name === "context")) {
  await database.execute(
    "ALTER TABLE projects ADD COLUMN context TEXT"
  );
}

    await database.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'note',
        sortOrder INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )
    `);
    const documentColumns = await database.select<{ name: string }[]>("PRAGMA table_info(documents)");
    if (!documentColumns.some((column) => column.name === "kind")) {
      await database.execute("ALTER TABLE documents ADD COLUMN kind TEXT NOT NULL DEFAULT 'note'");
    }
    if (!documentColumns.some((column) => column.name === "sortOrder")) {
      await database.execute("ALTER TABLE documents ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");
    }

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

    await database.execute(`CREATE TABLE IF NOT EXISTS knowledge_entities (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT, details TEXT, externalLinks TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (projectId) REFERENCES projects(id))`);
    const entityColumns = await database.select<{ name: string }[]>("PRAGMA table_info(knowledge_entities)");
    for (const column of ["details", "externalLinks"]) {
      if (!entityColumns.some((item) => item.name === column)) await database.execute(`ALTER TABLE knowledge_entities ADD COLUMN ${column} TEXT`);
    }
    if (!entityColumns.some((column) => column.name === "sortOrder")) {
      await database.execute("ALTER TABLE knowledge_entities ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");
    }
    await database.execute(`CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, title TEXT NOT NULL,
      author TEXT, url TEXT, citation TEXT, publisher TEXT, year TEXT, doi TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (projectId) REFERENCES projects(id))`);
    const sourceColumns = await database.select<{ name: string }[]>("PRAGMA table_info(sources)");
    for (const column of ["publisher", "year", "doi"]) {
      if (!sourceColumns.some((item) => item.name === column)) {
        await database.execute(`ALTER TABLE sources ADD COLUMN ${column} TEXT`);
      }
    }
    if (!sourceColumns.some((item) => item.name === "sortOrder")) await database.execute("ALTER TABLE sources ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");
    await database.execute(`CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, fromId TEXT NOT NULL,
      fromType TEXT NOT NULL, toId TEXT NOT NULL, toType TEXT NOT NULL,
      kind TEXT NOT NULL, createdAt TEXT NOT NULL, note TEXT, anchor TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id))`);
    const relationColumns = await database.select<{ name: string }[]>("PRAGMA table_info(relations)");
    if (!relationColumns.some((column) => column.name === "anchor")) {
      await database.execute("ALTER TABLE relations ADD COLUMN anchor TEXT");
    }
    await database.execute(`CREATE TABLE IF NOT EXISTS composition_entries (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, chapterId TEXT NOT NULL,
      fragmentId TEXT NOT NULL, sortOrder INTEGER NOT NULL, createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id),
      FOREIGN KEY (chapterId) REFERENCES documents(id),
      FOREIGN KEY (fragmentId) REFERENCES documents(id))`);
    await database.execute(`CREATE TABLE IF NOT EXISTS author_notes (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, content TEXT NOT NULL,
      color TEXT NOT NULL, targetType TEXT, targetId TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, sortOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (projectId) REFERENCES projects(id))`);
    const noteColumns = await database.select<{ name: string }[]>("PRAGMA table_info(author_notes)");
    if (!noteColumns.some((item) => item.name === "sortOrder")) await database.execute("ALTER TABLE author_notes ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");

    await database.execute(`CREATE TABLE IF NOT EXISTS project_tags (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, name TEXT NOT NULL,
      normalizedName TEXT NOT NULL, createdAt TEXT NOT NULL,
      UNIQUE (projectId, normalizedName),
      FOREIGN KEY (projectId) REFERENCES projects(id))`);
    await database.execute(`CREATE TABLE IF NOT EXISTS tag_assignments (
      projectId TEXT NOT NULL, tagId TEXT NOT NULL, targetType TEXT NOT NULL, targetId TEXT NOT NULL,
      PRIMARY KEY (projectId, tagId, targetType, targetId),
      FOREIGN KEY (projectId) REFERENCES projects(id),
      FOREIGN KEY (tagId) REFERENCES project_tags(id))`);
    await database.execute("CREATE INDEX IF NOT EXISTS idx_tag_assignments_target ON tag_assignments (projectId, targetType, targetId)");
    await database.execute(`CREATE TABLE IF NOT EXISTS passage_tag_assignments (
      projectId TEXT NOT NULL, tagId TEXT NOT NULL, targetId TEXT NOT NULL,
      documentId TEXT NOT NULL, quote TEXT NOT NULL, prefix TEXT NOT NULL, suffix TEXT NOT NULL,
      PRIMARY KEY (projectId, tagId, targetId, documentId, quote, prefix, suffix),
      FOREIGN KEY (projectId) REFERENCES projects(id),
      FOREIGN KEY (tagId) REFERENCES project_tags(id))`);

    return new SqliteProjectStorage(database);
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.database.select<
  (Project & { context: string | null })[]
>(
  "SELECT id, title, createdAt, updatedAt, context FROM projects ORDER BY createdAt"
);

return rows.map(({ context, ...project }) => ({
  ...project,
  context: context ? JSON.parse(context) as Project["context"] : undefined
}));
  }

  async getProject(projectId: Id): Promise<Project | null> {
  const rows = await this.database.select<
    (Project & { context: string | null })[]
  >(
    `SELECT id, title, createdAt, updatedAt, context
     FROM projects WHERE id = ?`,
    [projectId]
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  const { context, ...project } = row;

  return {
    ...project,
    context: context ? JSON.parse(context) as Project["context"] : undefined
  };
}

  async createProject(project: Project): Promise<void> {
  await this.database.execute(
    `INSERT INTO projects
     (id, title, createdAt, updatedAt, context)
     VALUES (?, ?, ?, ?, ?)`,
    [
      project.id,
      project.title,
      project.createdAt,
      project.updatedAt,
      project.context ? JSON.stringify(project.context) : null
    ]
  );
}

async updateProject(project: Project): Promise<void> {
  const result = await this.database.execute(
    `UPDATE projects
     SET title = ?, updatedAt = ?, context = ?
     WHERE id = ?`,
    [
      project.title,
      project.updatedAt,
      project.context ? JSON.stringify(project.context) : null,
      project.id
    ]
  );

  if (result.rowsAffected === 0) {
    throw new Error("No se puede actualizar un proyecto que no existe.");
  }
}

  async listDocuments(projectId: Id): Promise<DocumentRecord[]> {
    return this.database.select<DocumentRecord[]>(
      `SELECT id, projectId, title, text, createdAt, updatedAt, kind, sortOrder AS "order"
       FROM documents WHERE projectId = ? ORDER BY sortOrder, createdAt`,
      [projectId]
    );
  }

  async getDocument(documentId: Id): Promise<DocumentRecord | null> {
    const rows = await this.database.select<DocumentRecord[]>(
      `SELECT id, projectId, title, text, createdAt, updatedAt, kind, sortOrder AS "order"
       FROM documents WHERE id = ?`,
      [documentId]
    );
    return rows[0] ?? null;
  }

  async createDocument(document: DocumentRecord): Promise<void> {
    await this.database.execute(
      `INSERT INTO documents
       (id, projectId, title, text, createdAt, updatedAt, kind, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        document.id,
        document.projectId,
        document.title,
        document.text,
        document.createdAt,
        document.updatedAt,
        document.kind ?? "note",
        document.order ?? 0
      ]
    );
  }

  async updateDocument(document: DocumentRecord): Promise<void> {
    const result = await this.database.execute(
      `UPDATE documents
       SET projectId = ?, title = ?, text = ?, updatedAt = ?, kind = ?, sortOrder = ?
       WHERE id = ?`,
      [
        document.projectId,
        document.title,
        document.text,
        document.updatedAt,
        document.kind ?? "note",
        document.order ?? 0,
        document.id
      ]
    );

    if (result.rowsAffected === 0) {
      throw new Error("No se puede actualizar un documento que no existe.");
    }
  }

  async listKnowledgeEntities(projectId: Id): Promise<KnowledgeEntity[]> {
    const rows = await this.database.select<(Omit<KnowledgeEntity, "details" | "externalLinks"> & { details: string | null; externalLinks: string | null })[]>(
      "SELECT id, projectId, kind, title, description, details, externalLinks, sortOrder AS \"order\" FROM knowledge_entities WHERE projectId = ? ORDER BY sortOrder, title",
      [projectId]
    );
    return rows.map(({ details, externalLinks, ...entity }) => ({
      ...entity,
      details: details ? JSON.parse(details) as KnowledgeEntity["details"] : [],
      externalLinks: externalLinks ? JSON.parse(externalLinks) as KnowledgeEntity["externalLinks"] : []
    }));
  }

  async createKnowledgeEntity(entity: KnowledgeEntity): Promise<void> {
    await this.database.execute(
      "INSERT INTO knowledge_entities (id, projectId, kind, title, description, details, externalLinks, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [entity.id, entity.projectId, entity.kind, entity.title, entity.description ?? null, JSON.stringify(entity.details ?? []), JSON.stringify(entity.externalLinks ?? []), entity.order ?? 0]
    );
  }

  async updateKnowledgeEntity(entity: KnowledgeEntity): Promise<void> {
    const result = await this.database.execute(
      "UPDATE knowledge_entities SET kind = ?, title = ?, description = ?, details = ?, externalLinks = ?, sortOrder = ? WHERE id = ? AND projectId = ?",
      [entity.kind, entity.title, entity.description ?? null, JSON.stringify(entity.details ?? []), JSON.stringify(entity.externalLinks ?? []), entity.order ?? 0, entity.id, entity.projectId]
    );
    if (result.rowsAffected === 0) throw new Error("No se puede actualizar una ficha que no existe.");
  }

  async deleteKnowledgeEntity(projectId: Id, entityId: Id): Promise<void> {
    await this.database.execute("DELETE FROM tag_assignments WHERE projectId = ? AND targetType = 'entity' AND targetId = ?", [projectId, entityId]);
    await this.database.execute(
      "DELETE FROM relations WHERE projectId = ? AND ((fromId = ? AND fromType IN ('entity', 'event')) OR (toId = ? AND toType IN ('entity', 'event')))",
      [projectId, entityId, entityId]
    );
    await this.database.execute(
      "UPDATE author_notes SET targetType = NULL, targetId = NULL WHERE projectId = ? AND targetId = ? AND targetType IN ('entity', 'event')",
      [projectId, entityId]
    );
    await this.database.execute("DELETE FROM knowledge_entities WHERE projectId = ? AND id = ?", [projectId, entityId]);
  }

  listSources(projectId: Id): Promise<SourceRecord[]> {
    return this.database.select<SourceRecord[]>(
      "SELECT id, projectId, title, author, url, citation, publisher, year, doi, sortOrder AS \"order\" FROM sources WHERE projectId = ? ORDER BY sortOrder, title",
      [projectId]
    );
  }

  async createSource(source: SourceRecord): Promise<void> {
    await this.database.execute(
      "INSERT INTO sources (id, projectId, title, author, url, citation, publisher, year, doi, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [source.id, source.projectId, source.title, source.author ?? null, source.url ?? null, source.citation ?? null, source.publisher ?? null, source.year ?? null, source.doi ?? null, source.order ?? 0]
    );
  }

  async updateSource(source: SourceRecord): Promise<void> {
    const result = await this.database.execute(
      "UPDATE sources SET title = ?, author = ?, url = ?, citation = ?, publisher = ?, year = ?, doi = ?, sortOrder = ? WHERE id = ? AND projectId = ?",
      [source.title, source.author ?? null, source.url ?? null, source.citation ?? null, source.publisher ?? null, source.year ?? null, source.doi ?? null, source.order ?? 0, source.id, source.projectId]
    );
    if (result.rowsAffected === 0) throw new Error("No se puede actualizar una fuente que no existe.");
  }

  async deleteSource(projectId: Id, sourceId: Id): Promise<void> {
    await this.database.execute("DELETE FROM tag_assignments WHERE projectId = ? AND targetType = 'source' AND targetId = ?", [projectId, sourceId]);
    await this.database.execute(
      "DELETE FROM relations WHERE projectId = ? AND ((fromType = 'source' AND fromId = ?) OR (toType = 'source' AND toId = ?))",
      [projectId, sourceId, sourceId]
    );
    await this.database.execute(
      "UPDATE author_notes SET targetType = NULL, targetId = NULL WHERE projectId = ? AND targetType = 'source' AND targetId = ?",
      [projectId, sourceId]
    );
    await this.database.execute("DELETE FROM sources WHERE projectId = ? AND id = ?", [projectId, sourceId]);
  }

  listRelations(projectId: Id): Promise<Relation[]> {
    return this.database.select<(Omit<Relation, "anchor"> & { anchor: string | null })[]>(
      "SELECT id, projectId, fromId, fromType, toId, toType, kind, createdAt, note, anchor FROM relations WHERE projectId = ? ORDER BY createdAt",
      [projectId]
    ).then((rows) => rows.map(({ anchor, ...relation }) => ({
      ...relation, anchor: anchor ? JSON.parse(anchor) as Relation["anchor"] : undefined
    })));
  }

  async createRelation(relation: Relation): Promise<void> {
    await this.database.execute(
      "INSERT INTO relations (id, projectId, fromId, fromType, toId, toType, kind, createdAt, note, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [relation.id, relation.projectId, relation.fromId, relation.fromType, relation.toId, relation.toType, relation.kind, relation.createdAt, relation.note ?? null, relation.anchor ? JSON.stringify(relation.anchor) : null]
    );
  }

  async updateRelation(relation: Relation): Promise<void> {
    const result = await this.database.execute(
      "UPDATE relations SET fromId = ?, fromType = ?, toId = ?, toType = ?, kind = ?, createdAt = ?, note = ?, anchor = ? WHERE projectId = ? AND id = ?",
      [relation.fromId, relation.fromType, relation.toId, relation.toType, relation.kind, relation.createdAt, relation.note ?? null, relation.anchor ? JSON.stringify(relation.anchor) : null, relation.projectId, relation.id]
    );
    if (result.rowsAffected === 0) throw new Error("No se puede actualizar una relación que no existe.");
  }

  async deleteRelation(projectId: Id, relationId: Id): Promise<void> {
    await this.database.execute("DELETE FROM relations WHERE projectId = ? AND id = ?", [projectId, relationId]);
  }

  async listCompositionEntries(chapterId: Id): Promise<CompositionEntry[]> {
    const rows = await this.database.select<(Omit<CompositionEntry, "order"> & { sortOrder: number })[]>(
      "SELECT id, projectId, chapterId, fragmentId, sortOrder, createdAt FROM composition_entries WHERE chapterId = ? ORDER BY sortOrder",
      [chapterId]
    );
    return rows.map(({ sortOrder, ...entry }) => ({ ...entry, order: sortOrder }));
  }

  async createCompositionEntry(entry: CompositionEntry): Promise<void> {
    await this.database.execute(
      "INSERT INTO composition_entries (id, projectId, chapterId, fragmentId, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [entry.id, entry.projectId, entry.chapterId, entry.fragmentId, entry.order, entry.createdAt]
    );
  }

  async deleteCompositionEntry(chapterId: Id, entryId: Id): Promise<void> {
    await this.database.execute("DELETE FROM composition_entries WHERE chapterId = ? AND id = ?", [chapterId, entryId]);
  }

  async reorderCompositionEntries(chapterId: Id, entryIds: Id[]): Promise<void> {
    const current = await this.listCompositionEntries(chapterId);
    if (current.length !== entryIds.length || new Set(entryIds).size !== entryIds.length || current.some((entry) => !entryIds.includes(entry.id))) {
      throw new Error("El nuevo orden debe incluir cada pieza del capítulo exactamente una vez.");
    }
    for (const [order, id] of entryIds.entries()) {
      await this.database.execute("UPDATE composition_entries SET sortOrder = ? WHERE chapterId = ? AND id = ?", [order, chapterId, id]);
    }
  }

  listAuthorNotes(projectId: Id): Promise<AuthorNote[]> {
    return this.database.select<AuthorNote[]>(
      "SELECT id, projectId, content, color, targetType, targetId, createdAt, updatedAt, sortOrder AS \"order\" FROM author_notes WHERE projectId = ? ORDER BY sortOrder, updatedAt DESC",
      [projectId]
    );
  }

  async createAuthorNote(note: AuthorNote): Promise<void> {
    await this.database.execute(
      "INSERT INTO author_notes (id, projectId, content, color, targetType, targetId, createdAt, updatedAt, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [note.id, note.projectId, note.content, note.color, note.targetType ?? null, note.targetId ?? null, note.createdAt, note.updatedAt, note.order ?? 0]
    );
  }

  async updateAuthorNote(note: AuthorNote): Promise<void> {
    const result = await this.database.execute(
      "UPDATE author_notes SET content = ?, color = ?, targetType = ?, targetId = ?, updatedAt = ?, sortOrder = ? WHERE id = ? AND projectId = ?",
      [note.content, note.color, note.targetType ?? null, note.targetId ?? null, note.updatedAt, note.order ?? 0, note.id, note.projectId]
    );
    if (result.rowsAffected === 0) throw new Error("No se puede actualizar una nota que no existe.");
  }

  async deleteAuthorNote(projectId: Id, noteId: Id): Promise<void> {
    await this.database.execute("DELETE FROM tag_assignments WHERE projectId = ? AND targetType = 'author_note' AND targetId = ?", [projectId, noteId]);
    await this.database.execute("DELETE FROM author_notes WHERE projectId = ? AND id = ?", [projectId, noteId]);
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

  listTags(projectId: Id): Promise<Tag[]> {
    return this.database.select<Tag[]>(
      "SELECT id, projectId, name, normalizedName, createdAt FROM project_tags WHERE projectId = ? ORDER BY name COLLATE NOCASE",
      [projectId]
    );
  }

  async createTag(tag: Tag): Promise<void> {
    await this.database.execute(
      "INSERT INTO project_tags (id, projectId, name, normalizedName, createdAt) VALUES (?, ?, ?, ?, ?)",
      [tag.id, tag.projectId, tag.name, tag.normalizedName, tag.createdAt]
    );
  }

  async updateTag(tag: Tag): Promise<void> {
    const result = await this.database.execute(
      "UPDATE project_tags SET name = ?, normalizedName = ? WHERE id = ? AND projectId = ?",
      [tag.name, tag.normalizedName, tag.id, tag.projectId]
    );
    if (result.rowsAffected === 0) throw new Error("No se puede actualizar una etiqueta que no existe.");
  }

  async deleteTag(projectId: Id, tagId: Id): Promise<void> {
    await this.database.execute("DELETE FROM passage_tag_assignments WHERE projectId = ? AND tagId = ?", [projectId, tagId]);
    await this.database.execute("DELETE FROM tag_assignments WHERE projectId = ? AND tagId = ?", [projectId, tagId]);
    await this.database.execute("DELETE FROM project_tags WHERE projectId = ? AND id = ?", [projectId, tagId]);
  }

  async listTagAssignments(projectId: Id): Promise<TagAssignment[]> {
    const documentAssignments = await this.database.select<TagAssignment[]>(
      "SELECT projectId, tagId, targetType, targetId FROM tag_assignments WHERE projectId = ?",
      [projectId]
    );
    const passageAssignments = await this.database.select<Array<TagAssignment & { documentId: Id; quote: string; prefix: string; suffix: string }>>(
      "SELECT projectId, tagId, 'document' AS targetType, targetId, documentId, quote, prefix, suffix FROM passage_tag_assignments WHERE projectId = ?",
      [projectId]
    );
    return [...documentAssignments, ...passageAssignments.map(({ documentId, quote, prefix, suffix, ...assignment }) => ({
      ...assignment, anchor: { documentId, quote, prefix, suffix }
    }))];
  }

  async assignTag(assignment: TagAssignment): Promise<void> {
    if (assignment.anchor) {
      await this.database.execute(
        "INSERT OR IGNORE INTO passage_tag_assignments (projectId, tagId, targetId, documentId, quote, prefix, suffix) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [assignment.projectId, assignment.tagId, assignment.targetId, assignment.anchor.documentId, assignment.anchor.quote, assignment.anchor.prefix, assignment.anchor.suffix]
      );
      return;
    }
    await this.database.execute(
      "INSERT OR IGNORE INTO tag_assignments (projectId, tagId, targetType, targetId) VALUES (?, ?, ?, ?)",
      [assignment.projectId, assignment.tagId, assignment.targetType, assignment.targetId]
    );
  }

  async unassignTag(assignment: TagAssignment): Promise<void> {
    if (assignment.anchor) {
      await this.database.execute(
        "DELETE FROM passage_tag_assignments WHERE projectId = ? AND tagId = ? AND targetId = ? AND documentId = ? AND quote = ? AND prefix = ? AND suffix = ?",
        [assignment.projectId, assignment.tagId, assignment.targetId, assignment.anchor.documentId, assignment.anchor.quote, assignment.anchor.prefix, assignment.anchor.suffix]
      );
      return;
    }
    await this.database.execute(
      "DELETE FROM tag_assignments WHERE projectId = ? AND tagId = ? AND targetType = ? AND targetId = ?",
      [assignment.projectId, assignment.tagId, assignment.targetType, assignment.targetId]
    );
  }
}
