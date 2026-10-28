# Lintea: modelo de historial y estados salvaguardables

Documento de decisión para orientar el diseño del historial por deltas, la comparación de estados, la colaboración y el formato LinteaZip.

Versión 0.1 · Documento de trabajo

## Idea central

El historial de Lintea distingue dos conceptos que no deben confundirse:

- **Estado** (`DocumentState`): la foto completa de un documento en un momento. Es lo que se compara, se restaura y se exporta.
- **Cambio** (`DocumentChange`): la diferencia entre dos estados. Es lo que se almacena en deltas y lo que se envía en colaboración.

El historial no guarda estados completos sucesivos: guarda un estado base y una cadena de cambios. Para comparar dos puntos, se reconstruyen ambos estados y se comparan. Para restaurar, se reconstruye el estado y se escribe solo el contenido propio. Para exportar, se guardan estados base y cadena de cambios.

## Qué es un estado salvaguardable

Un estado mínimo de documento incluye:

- `documentId`, `projectId`.
- `title`, `text`, `kind`, `order`: contenido propio del documento.
- `relationIds`: referencias a las relaciones activas en ese estado.
- `tagAssignmentKeys`: referencias a las asignaciones de etiqueta activas (generales y de pasaje).
- `authorNoteIds`: referencias a las notas del autor asociadas al documento.
- `compositionEntryIds`: referencias a las inclusiones en capítulos, si el documento es un fragmento.
- `capturedAt`: cuándo se capturó el estado.
- `documentUpdatedAt`: la fecha de actualización del documento en ese momento.

**Regla de referencia, no de copia**: las relaciones, etiquetas, notas y composición se guardan **por ID**, no como copias. Restaurar un estado reconstruye el contenido propio y compara las referencias con las que existen en el proyecto en ese momento:

- Una referencia que sigue existiendo se mantiene.
- Una referencia que ya no existe se marca como **referencia rota** y se pide revisión, sin resucitarla silenciosamente.
- Una relación, etiqueta o nota **nueva**, creada después del estado, **no se elimina** al restaurar el estado antiguo: sigue existiendo porque tiene identidad propia.

Esto respeta el principio de "no perder silenciosamente texto ni relaciones" y evita el efecto "restaurar una versión borra mis vínculos nuevos".

## Qué es un cambio

Un cambio es una transformación entre dos estados. Tipos previstos:

- `title`: cambio de título.
- `text`: cambio de texto, representado por párrafos (no por caracteres), con `hunks` que indican rangos de origen y destino.
- `kind`: cambio de rol del documento.
- `order`: cambio de orden en el manuscrito.
- `relation.added` / `relation.removed`: alta o baja de una relación por ID.
- `tag.assigned` / `tag.unassigned`: alta o baja de una asignación por `(tagId, targetType, targetId, anchorKey)`.
- `note.added` / `note.removed`: alta o baja de una nota por ID.
- `composition.added` / `composition.removed`: alta o baja de una inclusión por ID.

Cada cambio lleva la identidad del elemento afectado, no su contenido. Eso permite:

- Enviar solo las partes cambiadas en colaboración.
- Reconstruir estados sin ambigüedad.
- Comparar dos estados y mostrar qué cambió, sin perder la referencia al elemento original.

## Representación de una versión

Una `DocumentVersion` puede ser de dos formas:

- **Base**: guarda un `DocumentState` completo. Es la primera versión de un documento y el punto de partida de una cadena.
- **Delta**: guarda `parentVersionId` y un `DocumentChange[]`. Se aplica sobre el estado reconstruido del padre.

Una versión base sin `parentVersionId` es la raíz de una cadena. Una versión delta sin `parentVersionId` es un error de integridad y debe rechazarse.

La API pública actual de `DocumentVersion` se mantiene: una instantánea completa sin `parentVersionId` sigue siendo una base válida. Los tests existentes siguen pasando.

## Reconstrucción

`reconstructVersion(versions, versionId)` recorre la cadena de padres hasta la base y aplica los cambios en orden. Devuelve un `DocumentState`. Si un padre falta o la cadena tiene un ciclo, se lanza un error claro y no se devuelve un estado parcial.

Para comparar dos puntos, se reconstruyen ambos estados y se comparan con `diffStates(a, b): DocumentChange[]`. La comparación es determinista: mismos estados de entrada, mismos cambios de salida.

## Borrado de un punto de memoria

Eliminar una versión intermedia no debe romper la cadena. Si la versión tiene hijos:

- Se puede **rechazar** el borrado con un error que explique qué versiones dependen de ella.
- O se puede **reparentar**: los hijos pasan a apuntar al padre de la versión eliminada, y sus cambios se ajustan para seguir siendo válidos.

La primera opción es más segura y suficiente para la fase 1 del historial. La segunda se puede añadir después si el uso real lo pide.

## Colaboración

El historial por deltas **no asume bloqueo de secciones**. Los cambios son identificables y atribuibles; la fusión se resuelve explícitamente. El bloqueo de secciones, si se adopta, será una capa de coordinación encima del modelo de cambios, no parte del formato.

Cada cambio puede llevar, en el futuro, autoría y contexto (`authorId`, `capturedAt`, `deviceId`). El formato actual los deja opcionales para no romper nada.

## Exportación a `.ltz`

El `.ltz` debe poder reconstruir:

- Los estados base de cada documento.
- La cadena de cambios de cada documento.
- Las relaciones, etiquetas, notas y composición por ID, con sus referencias.
- Los metadatos de autoría y fecha si existen.

Por defecto se exporta el historial completo. Se ofrece una opción de exportar solo el estado actual, para reducir tamaño, con la advertencia de que el historial no se podrá reconstruir desde ese `.ltz`.

Las referencias rotas en el momento de exportar se incluyen como referencias con `missing: true`, para que la importación las marque y pida revisión, en lugar de descartarlas silenciosamente.

## Lo que queda fuera de este documento

- El transporte de colaboración (servidor, P2P, híbrido).
- El modelo de identidad y permisos.
- La política de resolución de conflictos.
- La UI de comparación lado a lado.
- La elección de librería de diff para presentación.

Estas decisiones se toman en la fase 3, con pruebas verificables, y no condicionan el formato de estados y cambios definido aquí.

## Decisiones adoptadas en esta versión

1. El estado salvaguardable incluye relaciones, etiquetas, notas y composición **por referencia**, no por copia.
2. El historial versiona documentos en esta fase; el diseño queda abierto a fichas, fuentes y notas sin romper el formato.
3. El historial no asume bloqueo de secciones.
4. El diff de texto se representa **por párrafos**.
5. El `.ltz` exporta el historial completo por defecto, con opción de exportar solo el estado actual.
## Control de integridad

### Integridad estructural

- Cada delta tiene `parentVersionId` que existe y pertenece al mismo documento.
- No hay ciclos.
- Una versión base no tiene `parentVersionId`.
- La cadena se aplica en orden determinista (por `parentVersionId`, no por orden de inserción).
- Reconstruir la cadena entera no falla.

Si algo de esto falla, se rechaza la operación o se marca la versión como corrupta. No se devuelve un estado parcial.

### Integridad de contenido

Cada versión guarda dos hashes calculados de forma canónica:

- `contentHash`: sobre `title`, `text`, `kind`, `order`. Detecta corrupción de deltas de contenido.
- `referenceHash`: sobre las referencias ordenadas (`relationIds`, `tagAssignmentKeys`, `authorNoteIds`, `compositionEntryIds`). Detecta corrupción de deltas de referencias.

Al reconstruir, se recalculan ambos y se comparan con los guardados. Si falla uno, la versión se marca como corrupta y no se devuelve estado parcial. El `referenceHash` de una versión histórica no cambia cuando se añaden relaciones nuevas al documento, porque la versión solo guarda las que existían en ese momento.

### Integridad referencial

El `DocumentState` reconstruido expone `referenceStatus` por tipo de referencia:

- `relations: Record<Id, "ok" | "missing">`
- `tagAssignments: Record<string, "ok" | "missing">`
- `authorNotes: Record<Id, "ok" | "missing">`
- `compositionEntries: Record<Id, "ok" | "missing">`

Se calcula al reconstruir comparando los IDs guardados en la versión con los que existen en el proyecto en ese momento. Se exporta tal cual a `.ltz`. Las referencias rotas se marcan como `missing: true`, no se descartan silenciosamente. Restaurar un estado antiguo no elimina referencias nuevas creadas después, porque tienen identidad propia.

## Organización de la cadena

El estado actual es la base del historial y siempre está íntegro. Las versiones históricas se guardan como cambios respecto a la versión siguiente, construyendo la cadena hacia atrás. Reconstruir el estado actual no requiere aplicar la cadena; reconstruir una versión antigua requiere aplicarla hacia atrás, con verificación de hashes.

Ventaja: un fallo al reconstruir una versión antigua no afecta al estado actual. El coste de un fallo es local y acotado.

## Borrado seguro

Tres operaciones, con nombres y alcance distintos:

- `deleteVersion(versionId)`: solo se permite si la versión no tiene hijos. Si los tiene, se rechaza con un mensaje que nombra las versiones dependientes por etiqueta y fecha, con el ID entre paréntesis. Función pura `canDeleteVersion(versions, versionId)` en `versions.ts`.
- `pruneHistory(before)`: borra versiones antiguas hacia delante, conservando el estado actual. Explícita, con confirmación, y fuera de la fase 1.
- `deleteVersionChain(versionId)`: **no soportada en fase 1**. Se documenta como no disponible para que no se implemente por error.

El borrado en cascada no es "borrar una versión intermedia": es podar el historial antiguo. Se nombran por separado para que no se confundan.

## Restauración

Restaurar una versión antigua es una operación explícita que:

1. Reconstruye el estado antiguo y verifica `contentHash` y `referenceHash`.
2. Escribe ese estado como nuevo estado actual (nueva base).
3. Archiva las versiones anteriores como **rama anterior**, accesibles pero no aplicadas. No se recalculan.

La restauración no borra el historial; lo reorganiza. La rama anterior queda disponible para consulta y para volver a restaurar si se decide.