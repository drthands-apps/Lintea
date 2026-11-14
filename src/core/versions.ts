
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
 * Relación del historial: arista entre dos estados del pasado.
 * No apunta: indica los extremos de una transición.
 */
export interface VersionRelation {
  id: Id;
  documentId: Id;
  projectId: Id;
  fromStateId: Id;
  toStateId: Id;
  capturedAt: string;
  label?: string;
  note?: string;
  /** Marcada por el usuario como olvidada: se conserva pero no se muestra en la ruta principal. */
  rejected?: boolean;
  /** El estado de origen ya no existe. */
  fromMissing?: boolean;
  /** El estado de destino ya no existe. */
  toMissing?: boolean;
}

/**
 * Estado pasado de un documento.
 *
 * - Si `pinned: true`, es un estado conservado íntegro y no depende de otro.
 * - Si `pinned` está ausente o es `false`, es un delta que se reconstruye
 *   aplicando `changes` sobre `baseStateId`.
 */
export interface DocumentVersion {
  id: Id;
  documentId: Id;
  projectId: Id;
  title: string;
  text: string;
  kind: string;
  order: number;
  capturedAt: string;
  documentUpdatedAt: string;
  label?: string;
  note?: string;
  /** Si es true, la versión está oculta en la UI por defecto. No afecta a la lógica. */
  hidden?: boolean;
  /** Fecha en que se ocultó. */
  hiddenAt?: string;
  /** Si esta versión fue reemplazada por otra (reconexión), id de la nueva. */
  replacedBy?: Id;
  /** Fecha en que fue reemplazada. */
  replacedAt?: string;

  /** Si es true, el estado se guarda íntegro y sirve como origen de rutas. */
  pinned?: boolean;

  /** Solo en estados delta: estado desde el que se calculó el delta. */
  baseStateId?: Id;
  /** Solo en estados delta: cambios respecto a baseStateId. */
  changes?: DocumentChange[];
  /** Si baseStateId ya no existe, el delta no se puede reconstruir. */
  baseMissing?: boolean;

  /** Hashes de integridad. */
  contentHash?: string;
  referenceHash?: string;

  /** Referencias activas en el estado. */
  relationIds?: Id[];
  tagAssignmentKeys?: string[];
  authorNoteIds?: Id[];
  compositionEntryIds?: Id[];
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
    kind: document.kind ?? "note",
    order: document.order ?? 0,
    capturedAt: date.toISOString(),
    documentUpdatedAt: document.updatedAt,
    label: optionalText(input.label),
    note: optionalText(input.note)
 
    // Sin pinned, sin baseStateId, sin changes: es un estado íntegro.
    // Los hashes y las referencias se calculan en la capa de servicio,
    // que conoce el proyecto completo.
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
 * Prepara un hijo huérfano para sobrevivir al borrado de su base.
 *
 * Estrategia conservadora: materializarlo como estado `pinned` con el
 * contenido reconstruido completo. Es correcto y no pierde datos. La
 * optimización por delta (fusionar `changes`) queda para más adelante;
 * el modelo acepta materializar como pinned cuando conviene.
 *
 * `grandparent` no se usa en esta primera iteración, pero se mantiene en
 * la firma para que la optimización futura no cambie los llamadores.
 */
/**
 * Crea una nueva versión a partir de un hijo huérfano, para reconectarlo
 * a la base de su padre oculto. Estrategia delta-first: si el abuelo existe
 * y se puede reconstruir el hijo, se calcula un delta `abuelo → hijo`.
 * Si no, se materializa como pinned.
 *
 * No modifica el hijo original. El llamador debe marcar el hijo original
 * con `hidden: true` y `replacedBy: nueva.id`.
 */
export function rebaseOrphanChild(
  versions: DocumentVersion[],
  deleted: DocumentVersion,
  child: DocumentVersion,
  grandparent: DocumentVersion | undefined,
  currentDocument: import("./model.js").DocumentRecord,
  now: () => Date = () => new Date()
): DocumentVersion {
  const reconstructed = reconstructVersion(versions, [], child.id, currentDocument);

  const baseState = grandparent
    ? reconstructVersion(versions, [], grandparent.id, currentDocument)
    : undefined;

  const canDelta = Boolean(grandparent && !grandparent.hidden);

  const common = {
    id: createId(),
    documentId: child.documentId,
    projectId: child.projectId,
    title: reconstructed.title,
    text: reconstructed.text,
    kind: reconstructed.kind,
    order: reconstructed.order,
    capturedAt: now().toISOString(),
    documentUpdatedAt: reconstructed.documentUpdatedAt,
    label: child.label,
    note: child.note,
    relationIds: child.relationIds,
    tagAssignmentKeys: child.tagAssignmentKeys,
    authorNoteIds: child.authorNoteIds,
    compositionEntryIds: child.compositionEntryIds,
    contentHash: contentHash({
      title: reconstructed.title,
      text: reconstructed.text,
      kind: reconstructed.kind,
      order: reconstructed.order
    }),
    referenceHash: referenceHash({
      relationIds: child.relationIds ?? [],
      tagAssignmentKeys: child.tagAssignmentKeys ?? [],
      authorNoteIds: child.authorNoteIds ?? [],
      compositionEntryIds: child.compositionEntryIds ?? []
    })
  };

  if (canDelta && baseState && grandparent) {
    const changes: DocumentChange[] = [
      { kind: "title", from: baseState.title, to: reconstructed.title },
      { kind: "text", from: baseState.text, to: reconstructed.text, hunks: [] },
      { kind: "kind", from: baseState.kind, to: reconstructed.kind },
      { kind: "order", from: baseState.order, to: reconstructed.order }
    ].filter((c) => {
      if (c.kind === "title" || c.kind === "text" || c.kind === "kind" || c.kind === "order") {
        return c.from !== c.to;
      }
      return true;
    }) as DocumentChange[];

    return {
      ...common,
      pinned: false,
      baseStateId: grandparent.id,
      changes
    };
  }

  return {
    ...common,
    pinned: true
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

function applyChange(state: DocumentState, change: DocumentChange): DocumentState {
  switch (change.kind) {
    case "title": return { ...state, title: change.to };
    case "text": return { ...state, text: change.to };
    case "kind": return { ...state, kind: change.to as DocumentState["kind"] };
    case "order": return { ...state, order: change.to };
    case "relation.added": return { ...state, relationIds: [...state.relationIds, change.relationId] };
    case "relation.removed": return { ...state, relationIds: state.relationIds.filter((id) => id !== change.relationId) };
    case "tag.assigned": return { ...state, tagAssignmentKeys: [...state.tagAssignmentKeys, change.tagId] };
    case "tag.unassigned": return { ...state, tagAssignmentKeys: state.tagAssignmentKeys.filter((key) => key !== change.tagId) };
    case "note.added": return { ...state, authorNoteIds: [...state.authorNoteIds, change.noteId] };
    case "note.removed": return { ...state, authorNoteIds: state.authorNoteIds.filter((id) => id !== change.noteId) };
    case "composition.added": return { ...state, compositionEntryIds: [...state.compositionEntryIds, change.entryId] };
    case "composition.removed": return { ...state, compositionEntryIds: state.compositionEntryIds.filter((id) => id !== change.entryId) };
    default: return state;
  }
}

/**
 * Busca el camino más corto desde el estado actual hasta el objetivo
 * usando BFS sobre el grafo de relaciones.
 */
function findPath(
  relations: VersionRelation[],
  startId: Id,
  targetId: Id
): VersionRelation[] | null {
  const queue: { id: Id; path: VersionRelation[] }[] = [{ id: startId, path: [] }];
  const visited = new Set<Id>([startId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === targetId) return path;

    const outgoing = relations.filter((r) => r.fromStateId === id && !r.fromMissing && !r.toMissing);
    for (const rel of outgoing) {
      if (!visited.has(rel.toStateId)) {
        visited.add(rel.toStateId);
        queue.push({ id: rel.toStateId, path: [...path, rel] });
      }
    }
  }
  return null;
}

export function reconstructVersion(
  versions: DocumentVersion[],
  relations: VersionRelation[],
  targetStateId: Id,
  currentDocument: import("./model.js").DocumentRecord
): DocumentState {
  // 1. Si piden el estado actual (por ID de documento), lo devolvemos directamente.
  if (targetStateId === currentDocument.id) {
    return {
      documentId: currentDocument.id,
      projectId: currentDocument.projectId,
      title: currentDocument.title,
      text: currentDocument.text,
      kind: currentDocument.kind ?? "note",
      order: currentDocument.order ?? 0,
      relationIds: [],
      tagAssignmentKeys: [],
      authorNoteIds: [],
      compositionEntryIds: [],
      capturedAt: new Date().toISOString(),
      documentUpdatedAt: currentDocument.updatedAt,
      referenceStatus: { relations: {}, tagAssignments: {}, authorNotes: {}, compositionEntries: {} }
    };
  }

  const target = versions.find((v) => v.id === targetStateId);
  if (!target) throw new Error("El estado solicitado no existe en el historial.");


  // 2. Si es un estado conservado (pinned), lo devolvemos directamente.
  if (target.pinned) {
    const state: DocumentState = {
      documentId: target.documentId,
      projectId: target.projectId,
      title: target.title,
      text: target.text,
      kind: target.kind as DocumentState["kind"],
      order: target.order,    
      relationIds: target.relationIds ?? [],
      tagAssignmentKeys: target.tagAssignmentKeys ?? [],
      authorNoteIds: target.authorNoteIds ?? [],
      compositionEntryIds: target.compositionEntryIds ?? [],
      capturedAt: target.capturedAt,
      documentUpdatedAt: target.documentUpdatedAt,
      referenceStatus: { relations: {}, tagAssignments: {}, authorNotes: {}, compositionEntries: {} }
    };
    if (target.contentHash && contentHash(state) !== target.contentHash) {
      throw new Error(`La versión ${target.id} está corrupta: el contentHash no coincide.`);
    }
    return state;
  }

 
  
    // 3. Es un delta. Reconstruimos desde su base.
  const base = versions.find((v) => v.id === target.baseStateId);
  if (!base) {
    throw new Error(`No se puede reconstruir la versión ${target.id}: su base (${target.baseStateId}) no existe.`);
  }

  // El estado inicial es la base (si es pinned, su contenido; si no, hay que reconstruirla también)
    // El estado inicial es la base (si es pinned, su contenido; si no, hay que reconstruirla también)
  let currentState: DocumentState = {
    documentId: base.documentId,
    projectId: base.projectId,
    title: base.title,
    text: base.text,
    kind: base.kind as DocumentState["kind"],
    order: base.order,
    relationIds: base.relationIds ?? [],
    tagAssignmentKeys: base.tagAssignmentKeys ?? [],
    authorNoteIds: base.authorNoteIds ?? [],
    compositionEntryIds: base.compositionEntryIds ?? [],
    capturedAt: base.capturedAt,
    documentUpdatedAt: base.documentUpdatedAt,
    referenceStatus: { relations: {}, tagAssignments: {}, authorNotes: {}, compositionEntries: {} }
  };

  // Aplicamos los changes del target sobre la base
  for (const change of target.changes ?? []) {
    currentState = applyChange(currentState, change);
  }

  // Verificación de hashes
  if (target.contentHash && contentHash(currentState) !== target.contentHash) {
    throw new Error(`La versión ${target.id} está corrupta: el contentHash no coincide.`);
  }
 






    
  

  // Verificación de hashes al final
  if (target.contentHash && contentHash(currentState) !== target.contentHash) {
    throw new Error(`La versión ${target.id} está corrupta: el contentHash no coincide.`);
  }
  if (target.referenceHash) {
    const expectedRefs = {
      relationIds: target.relationIds ?? [],
      tagAssignmentKeys: target.tagAssignmentKeys ?? [],
      authorNoteIds: target.authorNoteIds ?? [],
      compositionEntryIds: target.compositionEntryIds ?? []
    };
    if (referenceHash(expectedRefs) !== target.referenceHash) {
      throw new Error(`La versión ${target.id} está corrupta: el referenceHash no coincide.`);
    }
  }

  // Calcular referenceStatus comparando con el documento actual
  currentState.referenceStatus = computeReferenceStatus(
    currentState,
    {
      relationIds: [], // En un caso real, el servicio pasaría las referencias actuales del proyecto
      tagAssignmentKeys: [],
      authorNoteIds: [],
      compositionEntryIds: []
    }
  );

  return currentState;
}

/**
 * Compara las referencias de un estado histórico con las que existen
 * actualmente en el proyecto para determinar su estado (ok o missing).
 */

export function computeReferenceStatus(
  state: DocumentState,
  currentReferences: {
    relationIds: Id[];
    tagAssignmentKeys: string[];
    authorNoteIds: Id[];
    compositionEntryIds: Id[];
  }
): DocumentState["referenceStatus"] {
  const status: DocumentState["referenceStatus"] = {
    relations: {},
    tagAssignments: {},
    authorNotes: {},
    compositionEntries: {}
  };

  const currentRelations = new Set(currentReferences.relationIds);
  const currentTagKeys = new Set(currentReferences.tagAssignmentKeys);
  const currentNotes = new Set(currentReferences.authorNoteIds);
  const currentEntries = new Set(currentReferences.compositionEntryIds);

  for (const id of state.relationIds) {
    status.relations[id] = currentRelations.has(id) ? "ok" : "missing";
  }
  for (const key of state.tagAssignmentKeys) {
    status.tagAssignments[key] = currentTagKeys.has(key) ? "ok" : "missing";
  }
  for (const id of state.authorNoteIds) {
    status.authorNotes[id] = currentNotes.has(id) ? "ok" : "missing";
  }
  for (const id of state.compositionEntryIds) {
    status.compositionEntries[id] = currentEntries.has(id) ? "ok" : "missing";
  }

  return status;
}



/**
 * Determina si un estado puede ser eliminado sin romper el grafo.
 */
export function canDeleteVersion(
  versions: DocumentVersion[],
  relations: VersionRelation[],
  stateId: Id
): {
  allowed: boolean;
  reason?: string;
  blockingRelations: Array<{
    id: Id;
    label?: string;
    capturedAt: string;
    fromStateId: Id;
    toStateId: Id;
    fromLabel?: string;
    fromTitle?: string;
    toLabel?: string;
    toTitle?: string;
  }>;
} {
  const target = versions.find((v) => v.id === stateId);
  if (!target) {
    return {
      allowed: false,
      reason: "La versión solicitada no existe en el historial.",
      blockingRelations: []
    };
  }

  const versionsById = new Map(versions.map((v) => [v.id, v]));
  const blockingRelations = relations
    .filter((r) => {
      const touches = r.fromStateId === stateId || r.toStateId === stateId;
      const isActive = !r.fromMissing && !r.toMissing && !r.rejected;
      return touches && isActive;
    })
    .map((r) => ({
      id: r.id,
      label: r.label,
      capturedAt: r.capturedAt,
      fromStateId: r.fromStateId,
      toStateId: r.toStateId,
      fromLabel: versionsById.get(r.fromStateId)?.label,
      fromTitle: versionsById.get(r.fromStateId)?.title,
      toLabel: versionsById.get(r.toStateId)?.label,
      toTitle: versionsById.get(r.toStateId)?.title
    }));

  if (blockingRelations.length === 0) {
    return { allowed: true, blockingRelations: [] };
  }

  const describe = (rel: typeof blockingRelations[number]) => {
    const date = new Date(rel.capturedAt);
    const formatted = Number.isNaN(date.getTime())
      ? rel.capturedAt
      : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    if (rel.label) {
      return `«${rel.label}» (${formatted})`;
    }
    const from = rel.fromLabel ?? rel.fromTitle ?? "sin título";
    const to = rel.toLabel ?? rel.toTitle ?? "sin título";
    return `«${from}» → «${to}» (${formatted})`;
  };

  const MAX_NOMBRADAS = 5;
  const nombres = blockingRelations.slice(0, MAX_NOMBRADAS).map(describe).join(", ");
  const restantes = blockingRelations.length - MAX_NOMBRADAS;
  const suffix = restantes > 0 ? ` y ${restantes} más` : "";

  return {
    allowed: false,
    reason: `No se puede eliminar «${target.label ?? target.title}» porque interrumpiría ${blockingRelations.length} relación${blockingRelations.length === 1 ? "" : "es"}: ${nombres}${suffix}. Marca esas relaciones como rechazadas o elimínalas primero.`,
    blockingRelations
  };
}

/**
 * Valida la estructura del grafo de relaciones del historial.
 * Lanza un error claro si hay ciclos, extremos inexistentes,
 * auto-relaciones o duplicados. No modifica nada.
 */
export function validateRelations(
  relations: VersionRelation[],
  versions: DocumentVersion[]
): void {
  const stateIds = new Set(versions.map((v) => v.id));
  const relationKeys = new Set<string>();

  for (const relation of relations) {
    // 1. Extremos deben existir
    if (!stateIds.has(relation.fromStateId)) {
      throw new Error(`La relación ${relation.id} apunta a un extremo de origen inexistente (${relation.fromStateId}).`);
    }
    if (!stateIds.has(relation.toStateId)) {
      throw new Error(`La relación ${relation.id} apunta a un extremo de destino inexistente (${relation.toStateId}).`);
    }

    // 2. No puede conectar un estado consigo mismo
    if (relation.fromStateId === relation.toStateId) {
      throw new Error(`La relación ${relation.id} conecta un estado consigo mismo (${relation.fromStateId}).`);
    }

    // 3. No puede haber relaciones duplicadas entre los mismos extremos
    const key = `${relation.fromStateId}->${relation.toStateId}`;
    if (relationKeys.has(key)) {
      throw new Error(`Existe una relación duplicada entre ${relation.fromStateId} y ${relation.toStateId}.`);
    }
    relationKeys.add(key);
  }

  // 4. Detección de ciclos (búsqueda en profundidad)
  const adjacencyList = new Map<Id, Id[]>();
  for (const relation of relations) {
    if (!adjacencyList.has(relation.fromStateId)) {
      adjacencyList.set(relation.fromStateId, []);
    }
    adjacencyList.get(relation.fromStateId)!.push(relation.toStateId);
  }

  const visited = new Set<Id>();
  const recursionStack = new Set<Id>();

  function hasCycle(nodeId: Id): boolean {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const stateId of stateIds) {
    if (hasCycle(stateId)) {
      throw new Error("El historial contiene un ciclo en la cadena de relaciones.");
    }
  }
  
}
