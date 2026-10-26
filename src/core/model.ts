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

export interface Project {
  id: Id;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: Id;
  projectId: Id;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface SourceRecord {
  id: Id;
  projectId: Id;
  title: string;
  author?: string;
  url?: string;
  citation?: string;
}

export type RelationTargetType = "fragment" | "entity" | "source" | "event";

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
