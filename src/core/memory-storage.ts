
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
} from "./model.js";
import type { DocumentVersion, VersionRelation } from "./versions.js";
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

function copyEntity(entity: KnowledgeEntity): KnowledgeEntity {
  return {
    ...entity,
    details: entity.details?.map((detail) => ({ ...detail })),
    externalLinks: entity.externalLinks?.map((link) => ({ ...link }))
  };
}

export class MemoryProjectStorage implements ProjectStorage {
  private readonly projects = new Map<Id, Project>();
  private readonly documents = new Map<Id, DocumentRecord>();
  private readonly versions = new Map<Id, DocumentVersion>();
  private readonly versionRelations = new Map<Id, VersionRelation>();
  private readonly entities = new Map<Id, KnowledgeEntity>();
  private readonly sources = new Map<Id, SourceRecord>();
  private readonly relations = new Map<Id, Relation>();
  private readonly composition = new Map<Id, CompositionEntry>();
  private readonly notes = new Map<Id, AuthorNote>();
  private readonly tags = new Map<Id, Tag>();
  private readonly tagAssignments = new Map<string, TagAssignment>();

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

    const current = this.documents.get(document.id)!;
    this.documents.set(document.id, { ...document, kind: document.kind ?? current.kind, order: document.order ?? current.order });
  }

    async updateDocumentVersion(version: DocumentVersion): Promise<void> {
    if (!this.versions.has(version.id)) {
      throw new Error("No se puede actualizar una versión que no existe.");
    }
    this.versions.set(version.id, { ...version });
  }

  async listKnowledgeEntities(projectId: Id): Promise<KnowledgeEntity[]> {
    return [...this.entities.values()].filter((item) => item.projectId === projectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)).map(copyEntity);
  }

  async createKnowledgeEntity(entity: KnowledgeEntity): Promise<void> {
    if (!this.projects.has(entity.projectId)) throw new Error("El proyecto de la ficha no existe.");
    if (this.entities.has(entity.id)) throw new Error("Ya existe una ficha con ese identificador.");
    this.entities.set(entity.id, copyEntity(entity));
  }

  async updateKnowledgeEntity(entity: KnowledgeEntity): Promise<void> {
    if (!this.entities.has(entity.id)) throw new Error("No se puede actualizar una ficha que no existe.");
    if (!this.projects.has(entity.projectId)) throw new Error("El proyecto de la ficha no existe.");
    this.entities.set(entity.id, copyEntity(entity));
  }

  async deleteKnowledgeEntity(projectId: Id, entityId: Id): Promise<void> {
    const entity = this.entities.get(entityId);
    if (entity?.projectId !== projectId) return;
    this.entities.delete(entityId);
    this.removeTagAssignments(projectId, "entity", entityId);
    for (const [id, relation] of this.relations) {
      const referencesEntity = (type: Relation["fromType"], targetId: Id) =>
        (type === "entity" || type === "event") && targetId === entityId;
      if (relation.projectId === projectId &&
        (referencesEntity(relation.fromType, relation.fromId) || referencesEntity(relation.toType, relation.toId))) {
        this.relations.delete(id);
      }
    }
    for (const [id, note] of this.notes) {
      if (note.projectId === projectId && note.targetId === entityId && (note.targetType === "entity" || note.targetType === "event")) {
        this.notes.set(id, { ...note, targetType: undefined, targetId: undefined });
      }
    }

  }

  async listSources(projectId: Id): Promise<SourceRecord[]> {
    return [...this.sources.values()].filter((item) => item.projectId === projectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)).map((item) => ({ ...item }));
  }

  async createSource(source: SourceRecord): Promise<void> {
    if (!this.projects.has(source.projectId)) throw new Error("El proyecto de la fuente no existe.");
    if (this.sources.has(source.id)) throw new Error("Ya existe una fuente con ese identificador.");
    this.sources.set(source.id, { ...source });
  }

  async updateSource(source: SourceRecord): Promise<void> {
    if (!this.sources.has(source.id)) throw new Error("No se puede actualizar una fuente que no existe.");
    if (!this.projects.has(source.projectId)) throw new Error("El proyecto de la fuente no existe.");
    this.sources.set(source.id, { ...source });
  }

  async deleteSource(projectId: Id, sourceId: Id): Promise<void> {
    if (this.sources.get(sourceId)?.projectId !== projectId) return;
    this.sources.delete(sourceId);
    this.removeTagAssignments(projectId, "source", sourceId);
    for (const [id, relation] of this.relations) {
      if (relation.projectId === projectId &&
        ((relation.fromType === "source" && relation.fromId === sourceId) ||
         (relation.toType === "source" && relation.toId === sourceId))) {
        this.relations.delete(id);
      }
    }
    for (const [id, note] of this.notes) {
      if (note.projectId === projectId && note.targetType === "source" && note.targetId === sourceId) {
        this.notes.set(id, { ...note, targetType: undefined, targetId: undefined });
      }
    }
  }

  async listRelations(projectId: Id): Promise<Relation[]> {
    return [...this.relations.values()].filter((item) => item.projectId === projectId).map((item) => ({ ...item, anchor: item.anchor ? { ...item.anchor } : undefined }));
  }

  async createRelation(relation: Relation): Promise<void> {
    if (!this.projects.has(relation.projectId)) throw new Error("El proyecto de la relación no existe.");
    if (this.relations.has(relation.id)) throw new Error("Ya existe una relación con ese identificador.");
    this.relations.set(relation.id, { ...relation, anchor: relation.anchor ? { ...relation.anchor } : undefined });
  }

  async updateRelation(relation: Relation): Promise<void> {
    if (this.relations.get(relation.id)?.projectId !== relation.projectId) throw new Error("No se puede actualizar una relación que no existe.");
    this.relations.set(relation.id, { ...relation, anchor: relation.anchor ? { ...relation.anchor } : undefined });
  }

  async deleteRelation(projectId: Id, relationId: Id): Promise<void> {
    const relation = this.relations.get(relationId);
    if (relation?.projectId === projectId) this.relations.delete(relationId);
  }

  async listCompositionEntries(chapterId: Id): Promise<CompositionEntry[]> {
    return [...this.composition.values()].filter((item) => item.chapterId === chapterId).sort((a, b) => a.order - b.order).map((item) => ({ ...item }));
  }

  async createCompositionEntry(entry: CompositionEntry): Promise<void> {
    const chapter = this.documents.get(entry.chapterId);
    const fragment = this.documents.get(entry.fragmentId);
    if (!chapter || !fragment || chapter.projectId !== entry.projectId || fragment.projectId !== entry.projectId) {
      throw new Error("El capítulo y el fragmento deben pertenecer al mismo proyecto.");
    }
    if (chapter.kind !== "chapter" || fragment.kind !== "fragment") {
      throw new Error("La composición requiere un capítulo y un fragmento.");
    }
    if (this.composition.has(entry.id)) throw new Error("Ya existe una pieza con ese identificador.");
    this.composition.set(entry.id, { ...entry });
  }

  async deleteCompositionEntry(chapterId: Id, entryId: Id): Promise<void> {
    if (this.composition.get(entryId)?.chapterId === chapterId) this.composition.delete(entryId);
  }

  async reorderCompositionEntries(chapterId: Id, entryIds: Id[]): Promise<void> {
    const entries = [...this.composition.values()].filter((item) => item.chapterId === chapterId);
    if (entries.length !== entryIds.length || new Set(entryIds).size !== entryIds.length || entries.some((item) => !entryIds.includes(item.id))) {
      throw new Error("El nuevo orden debe incluir cada pieza del capítulo exactamente una vez.");
    }
    entryIds.forEach((id, order) => {
      const entry = this.composition.get(id)!;
      this.composition.set(id, { ...entry, order });
    });
  }

  async listAuthorNotes(projectId: Id): Promise<AuthorNote[]> {
    return [...this.notes.values()].filter((note) => note.projectId === projectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || b.updatedAt.localeCompare(a.updatedAt)).map((note) => ({ ...note }));
  }

  async createAuthorNote(note: AuthorNote): Promise<void> {
    if (!this.projects.has(note.projectId)) throw new Error("El proyecto de la nota no existe.");
    if (this.notes.has(note.id)) throw new Error("Ya existe una nota con ese identificador.");
    this.notes.set(note.id, { ...note });
  }

  async updateAuthorNote(note: AuthorNote): Promise<void> {
    if (!this.notes.has(note.id)) throw new Error("No se puede actualizar una nota que no existe.");
    if (!this.projects.has(note.projectId)) throw new Error("El proyecto de la nota no existe.");
    this.notes.set(note.id, { ...note });
  }

  async deleteAuthorNote(projectId: Id, noteId: Id): Promise<void> {
    if (this.notes.get(noteId)?.projectId === projectId) {
      this.notes.delete(noteId);
      this.removeTagAssignments(projectId, "author_note", noteId);
    }
  }

  async listDocumentVersions(documentId: Id): Promise<DocumentVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.documentId === documentId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
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

  async deleteDocumentVersion(versionId: Id): Promise<void> {
    this.versions.delete(versionId);
  }

  async listTags(projectId: Id): Promise<Tag[]> {
    return [...this.tags.values()].filter((tag) => tag.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async createTag(tag: Tag): Promise<void> {
    if (!this.projects.has(tag.projectId)) throw new Error("El proyecto de la etiqueta no existe.");
    if (this.tags.has(tag.id)) throw new Error("Ya existe una etiqueta con ese identificador.");
    if ([...this.tags.values()].some((item) => item.projectId === tag.projectId && item.normalizedName === tag.normalizedName)) {
      throw new Error("Ya existe una etiqueta con ese nombre en este proyecto.");
    }
    this.tags.set(tag.id, { ...tag });
  }

  async updateTag(tag: Tag): Promise<void> {
    if (this.tags.get(tag.id)?.projectId !== tag.projectId) throw new Error("No se puede actualizar una etiqueta que no existe.");
    if ([...this.tags.values()].some((item) => item.id !== tag.id && item.projectId === tag.projectId && item.normalizedName === tag.normalizedName)) {
      throw new Error("Ya existe una etiqueta con ese nombre en este proyecto.");
    }
    this.tags.set(tag.id, { ...tag });
  }

  async deleteTag(projectId: Id, tagId: Id): Promise<void> {
    if (this.tags.get(tagId)?.projectId !== projectId) return;
    this.tags.delete(tagId);
    for (const [key, assignment] of this.tagAssignments) {
      if (assignment.projectId === projectId && assignment.tagId === tagId) this.tagAssignments.delete(key);
    }
  }

  async listTagAssignments(projectId: Id): Promise<TagAssignment[]> {
    return [...this.tagAssignments.values()].filter((item) => item.projectId === projectId).map((item) => ({
      ...item, ...(item.anchor ? { anchor: { ...item.anchor } } : {})
    }));
  }

  async assignTag(assignment: TagAssignment): Promise<void> {
    if (this.tags.get(assignment.tagId)?.projectId !== assignment.projectId) throw new Error("La etiqueta no pertenece a este proyecto.");
    const targetExists = assignment.targetType === "document"
      ? this.documents.get(assignment.targetId)?.projectId === assignment.projectId
      : assignment.targetType === "entity"
        ? this.entities.get(assignment.targetId)?.projectId === assignment.projectId
        : assignment.targetType === "source"
          ? this.sources.get(assignment.targetId)?.projectId === assignment.projectId
          : this.notes.get(assignment.targetId)?.projectId === assignment.projectId;
    if (!targetExists) throw new Error("El elemento etiquetado no pertenece a este proyecto.");
    const anchorKey = assignment.anchor ? `:${assignment.anchor.documentId}:${assignment.anchor.quote}:${assignment.anchor.prefix}:${assignment.anchor.suffix}` : "";
    this.tagAssignments.set(`${assignment.tagId}:${assignment.targetType}:${assignment.targetId}${anchorKey}`, { ...assignment });
  }

  async unassignTag(assignment: TagAssignment): Promise<void> {
    const anchorKey = assignment.anchor ? `:${assignment.anchor.documentId}:${assignment.anchor.quote}:${assignment.anchor.prefix}:${assignment.anchor.suffix}` : "";
    this.tagAssignments.delete(`${assignment.tagId}:${assignment.targetType}:${assignment.targetId}${anchorKey}`);
  }

  private removeTagAssignments(projectId: Id, targetType: TagAssignment["targetType"], targetId: Id): void {
    for (const [key, assignment] of this.tagAssignments) {
      if (assignment.projectId === projectId && assignment.targetType === targetType && assignment.targetId === targetId) {
        this.tagAssignments.delete(key);
      }
    }
  }
  async listVersionRelations(documentId: Id): Promise<VersionRelation[]> {
    return [...this.versionRelations.values()]
      .filter((relation) => relation.documentId === documentId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .map((relation) => ({ ...relation }));
  }

  async createVersionRelation(relation: VersionRelation): Promise<void> {
    if (this.versionRelations.has(relation.id)) {
      throw new Error("Ya existe una relación de historial con ese identificador.");
    }
    this.versionRelations.set(relation.id, { ...relation });
  }

  async updateVersionRelation(relation: VersionRelation): Promise<void> {
    if (!this.versionRelations.has(relation.id)) {
      throw new Error("No se puede actualizar una relación de historial que no existe.");
    }
    this.versionRelations.set(relation.id, { ...relation });
  }

  async deleteVersionRelation(documentId: Id, relationId: Id): Promise<void> {
    const relation = this.versionRelations.get(relationId);
    if (relation?.documentId === documentId) {
      this.versionRelations.delete(relationId);
    }
  }
}
