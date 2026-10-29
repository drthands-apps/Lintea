
import { createId, createRelation } from "../core/model.js";
import type {
  AuthorNote, AuthorNoteColor, CompositionEntry, DocumentRecord, EntityKind, Id, KnowledgeEntity,
  Project, Relation, RelationTargetType, SourceRecord, Tag, TagAssignment
} from "../core/model.js";
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
import type { VersionRelation } from "../core/versions.js";
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
getDocument(documentId: Id): Promise<DocumentRecord | null> {
  return this.storage.getDocument(documentId);
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

  async createKnowledgeEntity(input: {
    projectId: Id; kind: EntityKind; title: string; description?: string;
  }): Promise<KnowledgeEntity> {
    const title = input.title.trim();
    if (!title) throw new Error("El nombre de la ficha no puede estar vacío.");
    const entity: KnowledgeEntity = {
      id: createId(), projectId: input.projectId, kind: input.kind, title,
      description: input.description?.trim() || undefined,
      order: (await this.storage.listKnowledgeEntities(input.projectId)).length
    };
    await this.storage.createKnowledgeEntity(entity);
    return entity;
  }

  listKnowledgeEntities(projectId: Id): Promise<KnowledgeEntity[]> {
    return this.storage.listKnowledgeEntities(projectId);
  }

  async deleteKnowledgeEntity(projectId: Id, entityId: Id): Promise<void> {
    if (!(await this.storage.listKnowledgeEntities(projectId)).some((item) => item.id === entityId)) {
      throw new Error("No se puede eliminar una ficha que no existe en este proyecto.");
    }
    await this.storage.deleteKnowledgeEntity(projectId, entityId);
  }

  async updateKnowledgeEntity(entity: KnowledgeEntity): Promise<KnowledgeEntity> {
    const title = entity.title.trim();
    if (!title) throw new Error("El nombre de la ficha no puede estar vacío.");
    if (!(await this.storage.listKnowledgeEntities(entity.projectId)).some((item) => item.id === entity.id)) {
      throw new Error("No se puede actualizar una ficha que no existe en este proyecto.");
    }
    const externalLinks = (entity.externalLinks ?? []).filter((link) => link.label.trim() || link.url.trim()).map((link) => {
      const label = link.label.trim();
      const url = link.url.trim();
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new Error(`El enlace «${label || url}» no es válido.`); }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Los enlaces externos deben usar HTTP o HTTPS.");
      }
      if (!label) throw new Error("Cada enlace externo necesita una etiqueta.");
      return { label, url };
    });
    const updated = {
      ...entity,
      title,
      description: entity.description?.trim() || undefined,
      details: (entity.details ?? []).map((detail) => ({
        label: detail.label.trim(), value: detail.value.trim()
      })).filter((detail) => detail.label || detail.value),
      externalLinks
    };

    // Event fichas used to be stored as a distinct relation endpoint type.
    // Normalize those legacy edges to the canonical "entity" endpoint so
    // changing a ficha's kind cannot leave its relations or notes dangling.
    const [relations, notes] = await Promise.all([
      this.storage.listRelations(entity.projectId),
      this.storage.listAuthorNotes(entity.projectId)
    ]);
    for (const relation of relations) {
      const fromIsLegacyEvent = relation.fromType === "event" && relation.fromId === entity.id;
      const toIsLegacyEvent = relation.toType === "event" && relation.toId === entity.id;
      if (fromIsLegacyEvent || toIsLegacyEvent) {
        await this.storage.updateRelation({
          ...relation,
          fromType: fromIsLegacyEvent ? "entity" : relation.fromType,
          toType: toIsLegacyEvent ? "entity" : relation.toType
        });
      }
    }
    for (const note of notes) {
      if (note.targetId === entity.id && note.targetType === "event") {
        await this.updateAuthorNote({ ...note, targetType: "entity" });
      }
    }
    await this.storage.updateKnowledgeEntity(updated);
    return updated;
  }

  async createSource(input: {
    projectId: Id; title: string; author?: string; url?: string; citation?: string;
    publisher?: string; year?: string; doi?: string;
  }): Promise<SourceRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("El título de la fuente no puede estar vacío.");
    const source: SourceRecord = {
      id: createId(), projectId: input.projectId, title,
      author: input.author?.trim() || undefined,
      url: this.normalizeSourceUrl(input.url),
      citation: input.citation?.trim() || undefined,
      publisher: input.publisher?.trim() || undefined,
      year: input.year?.trim() || undefined,
      doi: input.doi?.trim() || undefined,
      order: (await this.storage.listSources(input.projectId)).length
    };
    await this.storage.createSource(source);
    return source;
  }

  listSources(projectId: Id): Promise<SourceRecord[]> {
    return this.storage.listSources(projectId);
  }

  async deleteSource(projectId: Id, sourceId: Id): Promise<void> {
    if (!(await this.storage.listSources(projectId)).some((item) => item.id === sourceId)) {
      throw new Error("No se puede eliminar una fuente que no existe en este proyecto.");
    }
    await this.storage.deleteSource(projectId, sourceId);
  }

  async updateSource(source: SourceRecord): Promise<SourceRecord> {
    const title = source.title.trim();
    if (!title) throw new Error("El título de la fuente no puede estar vacío.");
    if (!(await this.storage.listSources(source.projectId)).some((item) => item.id === source.id)) {
      throw new Error("No se puede actualizar una fuente que no existe en este proyecto.");
    }
    const url = this.normalizeSourceUrl(source.url);
    const updated: SourceRecord = {
      ...source, title, url, author: source.author?.trim() || undefined,
      citation: source.citation?.trim() || undefined,
      publisher: source.publisher?.trim() || undefined,
      year: source.year?.trim() || undefined, doi: source.doi?.trim() || undefined
    };
    await this.storage.updateSource(updated);
    return updated;
  }

  async createRelation(input: {
    projectId: Id; fromId: Id; fromType: RelationTargetType; toId: Id;
    toType: RelationTargetType; kind: Relation["kind"]; note?: string;
    anchor?: Relation["anchor"];
  }): Promise<Relation> {
    if (!(await this.storage.getProject(input.projectId))) {
      throw new Error("El proyecto de la relación no existe.");
    }
    for (const [id, type] of [[input.fromId, input.fromType], [input.toId, input.toType]] as const) {
      let belongs = false;
      if (type === "document") {
        belongs = (await this.storage.getDocument(id))?.projectId === input.projectId;
      } else if (type === "fragment") {
        const fragment = await this.storage.getDocument(id);
        belongs = fragment?.projectId === input.projectId && fragment.kind === "fragment";
      } else if (type === "entity") {
        belongs = (await this.storage.listKnowledgeEntities(input.projectId)).some((item) => item.id === id);
      } else if (type === "event") {
        belongs = (await this.storage.listKnowledgeEntities(input.projectId)).some((item) => item.id === id && item.kind === "event");
      } else if (type === "source") {
        belongs = (await this.storage.listSources(input.projectId)).some((item) => item.id === id);
      } else {
        throw new Error("Este tipo de elemento aún no está disponible para relacionar.");
      }
      if (!belongs) throw new Error("Los elementos de una relación deben existir en el mismo proyecto.");
    }
    if (input.anchor) {
      const anchorDocument = await this.storage.getDocument(input.anchor.documentId);
      const isRelatedDocument = [[input.fromId, input.fromType], [input.toId, input.toType]]
        .some(([id, type]) => id === input.anchor!.documentId && (type === "document" || type === "fragment"));
      if (anchorDocument?.projectId !== input.projectId || !isRelatedDocument) {
        throw new Error("El pasaje anclado debe pertenecer a uno de los documentos de la relación.");
      }
    }
    const relation = createRelation({
      ...input,
      fromType: input.fromType === "event" ? "entity" : input.fromType,
      toType: input.toType === "event" ? "entity" : input.toType,
      note: input.note?.trim() || undefined
    }, this.now);
    await this.storage.createRelation(relation);
    return relation;
  }

  listRelations(projectId: Id): Promise<Relation[]> {
    return this.storage.listRelations(projectId);
  }

  async updateRelationNote(projectId: Id, relationId: Id, note: string): Promise<Relation> {
    const relation = (await this.storage.listRelations(projectId)).find((item) => item.id === relationId);
    if (!relation) throw new Error("No se puede editar una relación que no existe en este proyecto.");
    const updated = { ...relation, note: note.trim() || undefined };
    await this.storage.updateRelation(updated);
    return updated;
  }

  deleteRelation(projectId: Id, relationId: Id): Promise<void> {
    return this.storage.deleteRelation(projectId, relationId);
  }

  async includeFragmentInChapter(chapterId: Id, fragmentId: Id): Promise<CompositionEntry> {
    const [chapter, fragment] = await Promise.all([
      this.storage.getDocument(chapterId), this.storage.getDocument(fragmentId)
    ]);
    if (!chapter || !fragment || chapter.projectId !== fragment.projectId) {
      throw new Error("El capítulo y el fragmento deben pertenecer al mismo proyecto.");
    }
    if (chapter.kind !== "chapter" || fragment.kind !== "fragment") {
      throw new Error("Selecciona un capítulo y un fragmento independiente.");
    }
    const entries = await this.storage.listCompositionEntries(chapterId);
    const entry: CompositionEntry = {
      id: createId(), projectId: chapter.projectId, chapterId, fragmentId,
      order: entries.length, createdAt: this.now().toISOString()
    };
    await this.storage.createCompositionEntry(entry);
    return entry;
  }

  listCompositionEntries(chapterId: Id): Promise<CompositionEntry[]> {
    return this.storage.listCompositionEntries(chapterId);
  }

  removeCompositionEntry(chapterId: Id, entryId: Id): Promise<void> {
    return this.storage.deleteCompositionEntry(chapterId, entryId);
  }

  reorderCompositionEntries(chapterId: Id, entryIds: Id[]): Promise<void> {
    return this.storage.reorderCompositionEntries(chapterId, entryIds);
  }

  listAuthorNotes(projectId: Id): Promise<AuthorNote[]> {
    return this.storage.listAuthorNotes(projectId);
  }

  async createAuthorNote(input: {
    projectId: Id; content: string; color?: AuthorNoteColor;
    targetType?: RelationTargetType; targetId?: Id;
  }): Promise<AuthorNote> {
    const content = input.content.trim();
    if (!content) throw new Error("La nota no puede estar vacía.");
    if (!(await this.storage.getProject(input.projectId))) throw new Error("El proyecto de la nota no existe.");
    if (input.targetType && input.targetId) {
      const type = input.targetType;
      let valid = false;
      if (type === "document" || type === "fragment") {
        const document = await this.storage.getDocument(input.targetId);
        valid = document?.projectId === input.projectId && (type !== "fragment" || document.kind === "fragment");
      } else if (type === "entity" || type === "event") {
        valid = (await this.storage.listKnowledgeEntities(input.projectId)).some((entity) => entity.id === input.targetId && (type !== "event" || entity.kind === "event"));
      } else if (type === "source") {
        valid = (await this.storage.listSources(input.projectId)).some((source) => source.id === input.targetId);
      }
      if (!valid) throw new Error("La nota y su elemento asociado deben pertenecer al mismo proyecto.");
    }
    const timestamp = this.now().toISOString();
    const currentNotes = await this.storage.listAuthorNotes(input.projectId);
    const note: AuthorNote = {
      id: createId(), projectId: input.projectId, content,
      color: input.color ?? "sand", targetType: input.targetType, targetId: input.targetId,
      createdAt: timestamp, updatedAt: timestamp,
      order: Math.max(-1, ...currentNotes.map((item) => item.order ?? 0)) + 1
    };
    await this.storage.createAuthorNote(note);
    return note;
  }

  async updateAuthorNote(note: AuthorNote): Promise<AuthorNote> {
    if (!note.content.trim()) throw new Error("La nota no puede estar vacía.");
    const current = (await this.storage.listAuthorNotes(note.projectId)).find((item) => item.id === note.id);
    if (!current) {
      throw new Error("No se puede actualizar una nota que no existe en este proyecto.");
    }
    if (note.targetType && note.targetId) {
      let valid = false;
      if (note.targetType === "document" || note.targetType === "fragment") {
        const document = await this.storage.getDocument(note.targetId);
        valid = document?.projectId === note.projectId && (note.targetType !== "fragment" || document.kind === "fragment");
      } else if (note.targetType === "entity" || note.targetType === "event") {
        valid = (await this.storage.listKnowledgeEntities(note.projectId)).some((entity) => entity.id === note.targetId && (note.targetType !== "event" || entity.kind === "event"));
      } else if (note.targetType === "source") {
        valid = (await this.storage.listSources(note.projectId)).some((source) => source.id === note.targetId);
      }
      if (!valid) throw new Error("La nota y su elemento asociado deben pertenecer al mismo proyecto.");
    }
    const content = note.content.trim();
    const hasContentChanges = content !== current.content || note.color !== current.color ||
      note.targetType !== current.targetType || note.targetId !== current.targetId;
    const updated = {
      ...note, content,
      updatedAt: hasContentChanges ? this.now().toISOString() : current.updatedAt
    };
    await this.storage.updateAuthorNote(updated);
    return updated;
  }

  deleteAuthorNote(projectId: Id, noteId: Id): Promise<void> {
    return this.storage.deleteAuthorNote(projectId, noteId);
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
    // El historial conserva estados únicos. Al restaurar o volver a guardar
    // un contenido ya registrado, se reutiliza su entrada aunque no sea la última.
    const existingState = versions.find((version) =>
      version.title === document.title && version.text === document.text
    );
    if (existingState) return existingState;

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

  listTags(projectId: Id): Promise<Tag[]> {
    return this.storage.listTags(projectId);
  }

  listTagAssignments(projectId: Id): Promise<TagAssignment[]> {
    return this.storage.listTagAssignments(projectId);
  }

  async createTag(projectId: Id, inputName: string): Promise<Tag> {
    const name = inputName.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("El nombre de la etiqueta no puede estar vacío.");
    if (!(await this.storage.getProject(projectId))) throw new Error("El proyecto de la etiqueta no existe.");
    const normalizedName = name.normalize("NFKC").toLocaleLowerCase("es");
    if ((await this.storage.listTags(projectId)).some((tag) => tag.normalizedName === normalizedName)) {
      throw new Error("Ya existe una etiqueta con ese nombre en este proyecto.");
    }
    const tag: Tag = { id: createId(), projectId, name, normalizedName, createdAt: this.now().toISOString() };
    await this.storage.createTag(tag);
    return tag;
  }

  async updateTag(projectId: Id, tagId: Id, inputName: string): Promise<Tag> {
    const name = inputName.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("El nombre de la etiqueta no puede estar vacío.");
    const tags = await this.storage.listTags(projectId);
    const current = tags.find((tag) => tag.id === tagId);
    if (!current) throw new Error("No se puede actualizar una etiqueta que no existe en este proyecto.");
    const normalizedName = name.normalize("NFKC").toLocaleLowerCase("es");
    if (tags.some((tag) => tag.id !== tagId && tag.normalizedName === normalizedName)) {
      throw new Error("Ya existe una etiqueta con ese nombre en este proyecto.");
    }
    const updated = { ...current, name, normalizedName };
    await this.storage.updateTag(updated);
    return updated;
  }

  async deleteTag(projectId: Id, tagId: Id): Promise<void> {
    if (!(await this.storage.listTags(projectId)).some((tag) => tag.id === tagId)) {
      throw new Error("No se puede eliminar una etiqueta que no existe en este proyecto.");
    }
    await this.storage.deleteTag(projectId, tagId);
  }

  async setTagAssignment(input: TagAssignment, assigned: boolean): Promise<void> {
    if (input.anchor && (input.targetType !== "document" || input.anchor.documentId !== input.targetId || !input.anchor.quote.trim())) {
      throw new Error("El pasaje etiquetado debe pertenecer al documento seleccionado.");
    }
    const tag = (await this.storage.listTags(input.projectId)).find((item) => item.id === input.tagId);
    if (!tag) throw new Error("La etiqueta no pertenece a este proyecto.");
    let targetExists = false;
    if (input.targetType === "document") {
      targetExists = (await this.storage.getDocument(input.targetId))?.projectId === input.projectId;
    } else if (input.targetType === "entity") {
      targetExists = (await this.storage.listKnowledgeEntities(input.projectId)).some((item) => item.id === input.targetId);
    } else if (input.targetType === "source") {
      targetExists = (await this.storage.listSources(input.projectId)).some((item) => item.id === input.targetId);
    } else {
      targetExists = (await this.storage.listAuthorNotes(input.projectId)).some((item) => item.id === input.targetId);
    }
    if (!targetExists) throw new Error("El elemento etiquetado no pertenece a este proyecto.");
    if (assigned) await this.storage.assignTag(input);
    else await this.storage.unassignTag(input);
  }
    private normalizeSourceUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim() || undefined;
  if (!trimmed) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("La dirección de la fuente no es válida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Los enlaces externos deben usar HTTP o HTTPS.");
  }
  return trimmed;
}
  listVersionRelations(documentId: Id): Promise<VersionRelation[]> {
    throw new Error("no implementado");
  }
}
