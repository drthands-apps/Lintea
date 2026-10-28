
import type { DocumentRecord, Id } from "./model.js";
import { createId } from "./model.js";

/**
 * Identificador reservado de la versión sintética que representa el estado
 * actual de un documento en el historial. No se persiste como versión: se
 * construye a partir del estado actual cada vez que se reconstruye.
 */
export const CURRENT_BASE_VERSION_ID: Id = "__current__";

/**
 * Cambio entre dos estados de un documento.
 *
 * Los cambios de contenido (title, text, kind, order) describen la
 * transformación. Los cambios de referencias (relation, tag, note,
 * composition) describen altas y bajas por identidad, no por contenido.
 */
export type DocumentChange =
  | { kind: "title"; from: string; to: string }
  | {
      kind: "text";
      from: string;
      to: string;
      hunks: Array<{
        fromStart: number;
        fromEnd: number;
        toStart: number;
        toEnd: number;
      }>;
    }
  | { kind: "kind"; from: string; to: string }
  | { kind: "order"; from: number; to: number }
  | { kind: "relation.added"; relationId: Id }
  | { kind: "relation.removed"; relationId: Id }
  | {
      kind: "tag.assigned";
      tagId: Id;
      targetType: string;
      targetId: Id;
      anchorKey?: string;
    }
  | {
      kind: "tag.unassigned";
      tagId: Id;
      targetType: string;
      targetId: Id;
      anchorKey?: string;
    }
  | { kind: "note.added"; noteId: Id }
  | { kind: "note.removed"; noteId: Id }
  | { kind: "composition.added"; entryId: Id }
  | { kind: "composition.removed"; entryId: Id };

 

/**
 * Fotografía inmutable de un documento en un momento determinado.
 *
 * Una versión conserva el título y el texto originales.
 * No depende de React, del almacenamiento ni de ningún proveedor externo.
 */
export interface DocumentVersion {
  id: Id;
  documentId: Id;
  projectId: Id;
  title: string;
  text: string;
  createdAt: string;
  documentUpdatedAt: string;
  label?: string;
  note?: string;
 /** Cadena del historial (modelo B: base = estado actual). */
  parentVersionId?: Id;
  changes?: DocumentChange[];

  /** Hashes de integridad. */
  contentHash?: string;
  referenceHash?: string;

  /** Referencias activas en el estado que representa esta versión. */
  relationIds?: Id[];
  tagAssignmentKeys?: string[];
  authorNoteIds?: Id[];
  compositionEntryIds?: Id[];

  /** Marca de rama anterior tras una restauración. */
  archived?: boolean;
}

/**
 * Estado completo de un documento en un momento del historial.
 *
 * El contenido propio se reconstruye aplicando cambios. Las referencias
 * se leen de la versión histórica y se contrastan con las que existen
 * en el proyecto en el momento de la reconstrucción.
 */
export interface DocumentState {
  documentId: Id;
  projectId: Id;
  title: string;
  text: string;
  kind: import("./model.js").DocumentKind;
  order: number;

  relationIds: Id[];
  tagAssignmentKeys: string[];
  authorNoteIds: Id[];
  compositionEntryIds: Id[];

  capturedAt: string;
  documentUpdatedAt: string;

  /**
   * Estado de cada referencia al reconstruir:
   * - "ok": la referencia existe en el proyecto.
   * - "missing": la referencia ya no existe; requiere revisión.
   */
  referenceStatus: {
    relations: Record<Id, "ok" | "missing">;
    tagAssignments: Record<string, "ok" | "missing">;
    authorNotes: Record<Id, "ok" | "missing">;
    compositionEntries: Record<Id, "ok" | "missing">;
  };
}


export interface CreateVersionInput {
  label?: string;
  note?: string;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Crea una fotografía del estado actual del documento.
 * No modifica el documento original.
 */
export function createDocumentVersion(
  document: DocumentRecord,
  input: CreateVersionInput = {},
  now: () => Date = () => new Date()
): DocumentVersion {
  const date = now();

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de la versión no es válida.");
  }

  return {
    id: createId(),
    documentId: document.id,
    projectId: document.projectId,
    title: document.title,
    text: document.text,
    createdAt: date.toISOString(),
    documentUpdatedAt: document.updatedAt,
    label: optionalText(input.label),
    note: optionalText(input.note)
  };
}

/**
 * Prepara el documento actual usando una versión anterior.
 *
 * No guarda nada por sí sola ni modifica la versión histórica.
 * La capa de aplicación deberá guardar primero el estado actual
 * y después persistir el documento restaurado.
 */
export function restoreDocumentVersion(
  current: DocumentRecord,
  version: DocumentVersion,
  now: () => Date = () => new Date()
): DocumentRecord {
  if (current.id !== version.documentId) {
    throw new Error(
      "La versión no pertenece al documento que se quiere recuperar."
    );
  }

  if (current.projectId !== version.projectId) {
    throw new Error(
      "La versión no pertenece al proyecto del documento."
    );
  }

  const date = now();

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de recuperación no es válida.");
  }

  // Si ya estamos en ese estado, no hay nada que cambiar.
  if (current.title === version.title && current.text === version.text) {
    return current;
  }

  return {
    ...current,
    title: version.title,
    text: version.text,
    updatedAt: date.toISOString()
  };
}

/**
 * Serialización canónica: claves ordenadas, sin espacios, arrays de IDs
 * ordenados. Dos estados con el mismo contenido producen la misma cadena.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * SHA-256 en JS puro. Devuelve hex. Se usa solo dentro de versions.ts
 * para no añadir dependencias al núcleo ni obligar a async en los tests.
 */
function sha256Hex(input: string): string {
  // Implementación compacta de SHA-256 (FIPS 180-4).
  // Ver https://datatracker.ietf.org/doc/html/rfc6234
  const bytes = new TextEncoder().encode(input);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bitLen = bytes.length * 8;
  const withPadding = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPadding.set(bytes);
  withPadding[bytes.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(withPadding.length - 4, bitLen >>> 0, false);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h = [(h[0]! + a) >>> 0, (h[1]! + b) >>> 0, (h[2]! + c) >>> 0, (h[3]! + d) >>> 0,
         (h[4]! + e) >>> 0, (h[5]! + f) >>> 0, (h[6]! + g) >>> 0, (h[7]! + hh) >>> 0];
  }
  return h.map((n) => n.toString(16).padStart(8, "0")).join("");
}
function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

export function contentHash(
  state: Pick<DocumentState, "title" | "text" | "kind" | "order">
): string {
  const canonical = canonicalJson({
    title: state.title,
    text: state.text,
    kind: state.kind,
    order: state.order
  });
  return sha256Hex(canonical);
}

export function referenceHash(
  state: Pick<
    DocumentState,
    "relationIds" | "tagAssignmentKeys" | "authorNoteIds" | "compositionEntryIds"
  >
): string {
  const canonical = canonicalJson({
    relationIds: [...(state.relationIds ?? [])].sort(),
    tagAssignmentKeys: [...(state.tagAssignmentKeys ?? [])].sort(),
    authorNoteIds: [...(state.authorNoteIds ?? [])].sort(),
    compositionEntryIds: [...(state.compositionEntryIds ?? [])].sort()
  });
  return sha256Hex(canonical);
}

export function reconstructVersion(
  versions: DocumentVersion[],
  versionId: Id,
  currentState: DocumentState
): DocumentState {
  const byId = new Map<Id, DocumentVersion>();
  for (const version of versions) byId.set(version.id, version);
  // La base actual siempre está disponible para cerrar la cadena.
  byId.set(CURRENT_BASE_VERSION_ID, currentStateToVersion(currentState));

  const target = byId.get(versionId);
  if (!target) {
    throw new Error("La versión solicitada no existe en el historial.");
  }

  // Si se pide reconstruir la base actual, ya la tenemos.
  if (target.id === CURRENT_BASE_VERSION_ID) {
    return currentState;
  }

  // Una versión con `changes` definido es un delta, aunque el array esté vacío.
  // Un delta siempre necesita padre; una base (sin `changes`) no.
  if (target.changes !== undefined && !target.parentVersionId) {
    throw new Error("Un delta debe tener parentVersionId; sin padre no se puede reconstruir.");
  }

 

  // Recorremos la cadena de padres hasta la base, detectando ciclos.
  const chain: DocumentVersion[] = [];
  const visited = new Set<Id>();
  let cursor: DocumentVersion | undefined = target;
  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new Error("El historial contiene un ciclo en la cadena de versiones.");
    }
    visited.add(cursor.id);
    chain.push(cursor);
    if (!cursor.parentVersionId) break;
    const parent = byId.get(cursor.parentVersionId);
    if (!parent) {
      throw new Error("Falta el padre de una versión en el historial.");
    }
    if (parent.documentId !== target.documentId) {
      throw new Error("El padre de una versión pertenece a otro documento.");
    }
    cursor = parent;
  }

  // Validación de deltas sin parentVersionId explícito en el modelo B:
  // una versión con `changes` debe tener padre, salvo que sea la base.
  for (const version of chain) {
    if (version.changes && version.changes.length > 0 && !version.parentVersionId) {
      // En el modelo B, la base es el estado actual y no tiene cambios.
      // Un delta sin padre es un error de integridad.
      if (version.id !== target.id || chain.length > 1) {
        throw new Error("Un delta debe tener parentVersionId.");
      }
    }
  }

  // Reconstrucción: partimos del estado actual (la base) y aplicamos
  // los cambios hacia atrás desde la versión más reciente de la cadena
  // hasta la versión objetivo.
  let state: DocumentState = { ...currentState };

  // La cadena va de la versión objetivo hacia la base. Para aplicar
  // cambios hacia atrás, invertimos: partimos del estado actual y
  // aplicamos los cambios de cada versión desde la base hacia la objetivo.
  const ordered = [...chain].reverse();

  for (const version of ordered) {
    if (!version.changes || version.changes.length === 0) {
      // Versión base: su contenido es el que ya tiene (instantánea completa).
      state = {
        ...state,
        title: version.title,
        text: version.text,
        capturedAt: version.createdAt,
        documentUpdatedAt: version.documentUpdatedAt
      };
      continue;
    }
    for (const change of version.changes) {
      state = applyChange(state, change);
    }
    state = {
      ...state,
      capturedAt: version.createdAt,
      documentUpdatedAt: version.documentUpdatedAt
    };
  }

  // Verificación de integridad de contenido.
  if (target.contentHash) {
    const actual = contentHash(state);
    if (actual !== target.contentHash) {
      throw new Error(
        `La versión ${target.id} está corrupta: el contentHash no coincide.`
      );
    }
  }

  // Verificación de integridad de referencias.
  const expectedReferences = {
    relationIds: target.relationIds ?? [],
    tagAssignmentKeys: target.tagAssignmentKeys ?? [],
    authorNoteIds: target.authorNoteIds ?? [],
    compositionEntryIds: target.compositionEntryIds ?? []
  };
  if (target.referenceHash) {
    const actual = referenceHash(expectedReferences);
    if (actual !== target.referenceHash) {
      throw new Error(
        `La versión ${target.id} está corrupta: el referenceHash no coincide.`
      );
    }
  }

  // Estado de las referencias de la versión frente al proyecto actual.
  const referenceStatus: DocumentState["referenceStatus"] = {
    relations: {},
    tagAssignments: {},
    authorNotes: {},
    compositionEntries: {}
  };
  const currentRelations = new Set(currentState.relationIds);
  const currentTagKeys = new Set(currentState.tagAssignmentKeys);
  const currentNotes = new Set(currentState.authorNoteIds);
  const currentEntries = new Set(currentState.compositionEntryIds);
  for (const id of expectedReferences.relationIds) {
    referenceStatus.relations[id] = currentRelations.has(id) ? "ok" : "missing";
  }
  for (const key of expectedReferences.tagAssignmentKeys) {
    referenceStatus.tagAssignments[key] = currentTagKeys.has(key) ? "ok" : "missing";
  }
  for (const id of expectedReferences.authorNoteIds) {
    referenceStatus.authorNotes[id] = currentNotes.has(id) ? "ok" : "missing";
  }
  for (const id of expectedReferences.compositionEntryIds) {
    referenceStatus.compositionEntries[id] = currentEntries.has(id) ? "ok" : "missing";
  }

  return {
    ...state,
    relationIds: expectedReferences.relationIds,
    tagAssignmentKeys: expectedReferences.tagAssignmentKeys,
    authorNoteIds: expectedReferences.authorNoteIds,
    compositionEntryIds: expectedReferences.compositionEntryIds,
    referenceStatus
  };
}

function applyChange(state: DocumentState, change: DocumentChange): DocumentState {
  switch (change.kind) {
    case "title":
      return { ...state, title: change.to };
    case "text":
      return { ...state, text: change.to };
    case "kind":
      return { ...state, kind: change.to as DocumentState["kind"] };
    case "order":
      return { ...state, order: change.to };
    case "relation.added":
      return { ...state, relationIds: [...state.relationIds, change.relationId] };
    case "relation.removed":
      return { ...state, relationIds: state.relationIds.filter((id) => id !== change.relationId) };
    case "tag.assigned":
      return { ...state, tagAssignmentKeys: [...state.tagAssignmentKeys, change.tagId] };
    case "tag.unassigned":
      return { ...state, tagAssignmentKeys: state.tagAssignmentKeys.filter((key) => key !== change.tagId) };
    case "note.added":
      return { ...state, authorNoteIds: [...state.authorNoteIds, change.noteId] };
    case "note.removed":
      return { ...state, authorNoteIds: state.authorNoteIds.filter((id) => id !== change.noteId) };
    case "composition.added":
      return { ...state, compositionEntryIds: [...state.compositionEntryIds, change.entryId] };
    case "composition.removed":
      return { ...state, compositionEntryIds: state.compositionEntryIds.filter((id) => id !== change.entryId) };
  }
}

export function canDeleteVersion(
  versions: DocumentVersion[],
  versionId: Id
): {
  allowed: boolean;
  reason?: string;
  blockingVersions: Array<{ id: Id; label?: string; capturedAt: string }>;
} {
  const target = versions.find((version) => version.id === versionId);
  if (!target) {
    return {
      allowed: false,
      reason: "La versión solicitada no existe en el historial.",
      blockingVersions: []
    };
  }

  const children = versions.filter((version) => version.parentVersionId === versionId);
  if (children.length === 0) {
    return { allowed: true, blockingVersions: [] };
  }

  const blockingVersions = children.map((child) => ({
    id: child.id,
    label: child.label,
    capturedAt: child.createdAt
  }));

  const describe = (child: { label?: string; capturedAt: string }) => {
    const date = new Date(child.capturedAt);
    const formatted = Number.isNaN(date.getTime())
      ? child.capturedAt
      : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    return `«${child.label ?? "Sin título"}» (${formatted})`;
  };

  const names = blockingVersions.map(describe).join(", ");
  return {
    allowed: false,
    reason: `No se puede eliminar «${target.label ?? target.title}» porque ${names} depende${blockingVersions.length === 1 ? "" : "n"} de ella. Elimina primero esa versión o conserva ambas.`,
    blockingVersions
  };
}
/**
 * Construye la versión sintética que representa el estado actual.
 * Es la raíz de la cadena del historial en el modelo B: los deltas
 * apuntan a ella con parentVersionId = CURRENT_BASE_VERSION_ID.
 */
export function currentStateToVersion(currentState: DocumentState): DocumentVersion {
  return {
    id: CURRENT_BASE_VERSION_ID,
    documentId: currentState.documentId,
    projectId: currentState.projectId,
    title: currentState.title,
    text: currentState.text,
    createdAt: currentState.capturedAt,
    documentUpdatedAt: currentState.documentUpdatedAt,
    contentHash: contentHash(currentState),
    referenceHash: referenceHash(currentState),
    relationIds: currentState.relationIds,
    tagAssignmentKeys: currentState.tagAssignmentKeys,
    authorNoteIds: currentState.authorNoteIds,
    compositionEntryIds: currentState.compositionEntryIds
  };
}
