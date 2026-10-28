/**
 * Tipos fundamentales de Lintea.
 *
 * El núcleo no depende de React, SQLite, Tauri ni proveedores de IA.
 */

export type Id = string;

export type EntityKind =
  | "character"
  | "place"
  | "event"
  | "story"
  | "concept"
  | "person"
  | "organization"
  | "other";

export type RelationKind =
  | "mentions"
  | "participates_in"
  | "occurs_at"
  | "supported_by"
  | "contradicts"
  | "related_to"
  | "inspired_by";

/** Canonical labels shared by the interface, exports and future collaboration tools. */
export const relationKindLabels: Record<RelationKind, string> = {
  mentions: "Menciona",
  participates_in: "Participa en",
  occurs_at: "Sucede en",
  supported_by: "Está sustentado por",
  contradicts: "Contradice",
  related_to: "Relacionado con",
  inspired_by: "Inspirado en"
};

export type DocumentKind = "chapter" | "fragment" | "note";

export type ProjectKind =
  | "fiction"
  | "research"
  | "essay"
  | "report"
  | "documentation"
  | "other";

export type EditorialStyle =
  | "classic"
  | "modern";

export interface ProjectContext {
  kind: ProjectKind;
  primaryLanguage: string;
  additionalLanguages: string[];
  editorialStyle: EditorialStyle;
  /** Installed text skin used to present or publish this project's documents. */
  textSkinId?: string;
}

export interface Project {
  id: Id;
  title: string;
  createdAt: string;
  updatedAt: string;
  context?: ProjectContext;
}

export interface DocumentRecord {
  id: Id;
  projectId: Id;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  /** Roles are optional for compatibility with projects created before this field existed. */
  kind?: DocumentKind;
  /** Explicit manuscript order; independent from creation and edit dates. */
  order?: number;
}

export interface FragmentAnchor {
  /** Identificador estable del fragmento, independiente de su posición. */
  fragmentId: Id;
  documentId: Id;
  /** Texto seleccionado al crear el anclaje. */
  quote: string;
  /** Texto que precedía a la selección, usado como pista de recuperación. */
  prefix: string;
  /** Texto que seguía a la selección, usado como pista de recuperación. */
  suffix: string;
}

export interface KnowledgeEntity {
  id: Id;
  projectId: Id;
  kind: EntityKind;
  title: string;
  description?: string;
  details?: EntityDetail[];
  externalLinks?: ExternalLink[];
  order?: number;
}

export interface EntityDetail {
  label: string;
  value: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export type AuthorNoteColor = "sage" | "sand" | "rose" | "sky";

export interface AuthorNote {
  id: Id;
  projectId: Id;
  content: string;
  color: AuthorNoteColor;
  targetType?: RelationTargetType;
  targetId?: Id;
  createdAt: string;
  updatedAt: string;
  order?: number;
}

export interface SourceRecord {
  id: Id;
  projectId: Id;
  title: string;
  author?: string;
  url?: string;
  citation?: string;
  publisher?: string;
  year?: string;
  doi?: string;
  order?: number;
}

export type RelationTargetType = "document" | "fragment" | "entity" | "source" | "event";

export interface Relation {
  id: Id;
  projectId: Id;
  fromId: Id;
  fromType: RelationTargetType;
  toId: Id;
  toType: RelationTargetType;
  kind: RelationKind;
  createdAt: string;
  note?: string;
  anchor?: Pick<FragmentAnchor, "documentId" | "quote" | "prefix" | "suffix">;
}

/** A stable reference to a fragment included in a chapter's composition. */
export interface CompositionEntry {
  id: Id;
  projectId: Id;
  chapterId: Id;
  fragmentId: Id;
  order: number;
  createdAt: string;
}

export type TagTargetType = "document" | "entity" | "source" | "author_note";

export interface Tag {
  id: Id;
  projectId: Id;
  name: string;
  normalizedName: string;
  createdAt: string;
}

export interface TagAssignment {
  projectId: Id;
  tagId: Id;
  targetType: TagTargetType;
  targetId: Id;
  /** When present, the tag applies to a passage in a document. */
  anchor?: Pick<FragmentAnchor, "documentId" | "quote" | "prefix" | "suffix">;
}

export function createId(): Id {
  return crypto.randomUUID();
}

export function createRelation(
  input: Omit<Relation, "id" | "createdAt">,
  now: () => Date = () => new Date()
): Relation {
  if (!input.fromId.trim() || !input.toId.trim()) {
    throw new Error("Una relación necesita identificadores de origen y destino.");
  }

  if (input.fromId === input.toId && input.fromType === input.toType) {
    throw new Error("Una relación no puede conectar un elemento consigo mismo.");
  }

  return {
    ...input,
    id: createId(),
    createdAt: now().toISOString()
  };
}
