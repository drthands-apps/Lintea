# Pendientes de Lintea v0.1

Lista viva de tareas acordadas y no cerradas. Actualizar al cerrar cada una.

## Historial por deltas (fase en curso)

- [ ] Refactorizar `saveDocumentVersion` en `WorkspaceService`:
  - Primera versión de un documento: base persistida (instantánea completa, sin `changes`).
  - Versiones posteriores: delta respecto a la más reciente no archivada.
  - Contenido idéntico a la más reciente: reutilizar esa versión, no crear nueva.
- [ ] Refactorizar `restoreDocumentVersion`:
  - Reconstruir el estado de la versión con `reconstructVersion(versions, versionId, currentState)`.
  - Escribir el estado restaurado como nuevo estado actual.
  - Marcar todas las versiones existentes con `archived: true`, sin borrarlas ni recalcular hashes.
  - No tocar relaciones, etiquetas, notas ni composición.
- [ ] Añadir `deleteDocumentVersion` en `WorkspaceService` usando `canDeleteVersion`.
- [ ] Decidir si, tras restaurar, los deltas futuros apuntan a `CURRENT_BASE_VERSION_ID`
  o a la versión restaurada. (Recomendación: `CURRENT_BASE_VERSION_ID`.)
- [ ] Añadir nota en `docs/Modelo_de_historial_v0.1.md` sobre la base sintética
  y la regla `changes !== undefined`.

## Otras anotaciones

- [ ] Imágenes en fichas de personajes y lugares (avatar/inspiración). No urgente.
- [ ] Revisar el modelo de datos completo antes de la fase de export LinteaZip,
  para no rehacer el formato dos veces.
- [ ] `npm run typecheck && npm test` como comprobación antes de cada commit.