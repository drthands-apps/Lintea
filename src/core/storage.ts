
import type {
  CompositionEntry,
  AuthorNote,
  DocumentRecord,
  Id,
  KnowledgeEntity,
  Project,
  Relation,
  SourceRecord,
  Tag,
  TagAssignment
} from "./model.js";
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

  listKnowledgeEntities(projectId: Id): Promise<KnowledgeEntity[]>;
  createKnowledgeEntity(entity: KnowledgeEntity): Promise<void>;
  updateKnowledgeEntity(entity: KnowledgeEntity): Promise<void>;
  deleteKnowledgeEntity(projectId: Id, entityId: Id): Promise<void>;
  listSources(projectId: Id): Promise<SourceRecord[]>;
  createSource(source: SourceRecord): Promise<void>;
  updateSource(source: SourceRecord): Promise<void>;
  deleteSource(projectId: Id, sourceId: Id): Promise<void>;
  listRelations(projectId: Id): Promise<Relation[]>;
  createRelation(relation: Relation): Promise<void>;
  updateRelation(relation: Relation): Promise<void>;
  deleteRelation(projectId: Id, relationId: Id): Promise<void>;
  listCompositionEntries(chapterId: Id): Promise<CompositionEntry[]>;
  createCompositionEntry(entry: CompositionEntry): Promise<void>;
  deleteCompositionEntry(chapterId: Id, entryId: Id): Promise<void>;
  reorderCompositionEntries(chapterId: Id, entryIds: Id[]): Promise<void>;
  listAuthorNotes(projectId: Id): Promise<AuthorNote[]>;
  createAuthorNote(note: AuthorNote): Promise<void>;
  updateAuthorNote(note: AuthorNote): Promise<void>;
  deleteAuthorNote(projectId: Id, noteId: Id): Promise<void>;

  listDocumentVersions(documentId: Id): Promise<DocumentVersion[]>;

  getDocumentVersion(versionId: Id): Promise<DocumentVersion | null>;

  createDocumentVersion(version: DocumentVersion): Promise<void>;

  listTags(projectId: Id): Promise<Tag[]>;
  createTag(tag: Tag): Promise<void>;
  updateTag(tag: Tag): Promise<void>;
  deleteTag(projectId: Id, tagId: Id): Promise<void>;
  listTagAssignments(projectId: Id): Promise<TagAssignment[]>;
  assignTag(assignment: TagAssignment): Promise<void>;
  unassignTag(assignment: TagAssignment): Promise<void>;
}
