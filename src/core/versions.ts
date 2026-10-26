
import type { DocumentRecord, Id } from "./model.js";
import { createId } from "./model.js";

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
