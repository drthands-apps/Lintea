# Lintea: modelo de historial v0.2 — estados y relaciones

Documento de decisión que sustituye al v0.1 en lo relativo a la organización
del historial. El v0.1 se conserva como histórico de la decisión anterior
(cadena con padres) y no debe usarse para implementar.

Versión 0.2 · Documento de trabajo

## Idea central

El historial de Lintea distingue tres conceptos que no deben confundirse:

- **Estado actual**: el documento tal cual está guardado. No es un nodo del
  grafo, no se calcula, no se reconstruye. Es la hoja desde la que se mira
  hacia atrás.
- **Estado pasado**: fotografía del contenido de un documento en un momento
  anterior. Se identifica por la tupla `(contentHash, referenceHash)`. Puede
  guardarse como delta (se reconstruye desde otro estado) o conservarse
  íntegro (`pinned: true`).
- **Relación**: arista entre dos estados del pasado (`fromStateId`,
  `toStateId`) con metadatos. Indica que en algún momento se pasó de un
  estado a otro. No es una flecha que apunta: es una relación entre dos
  extremos. Si un extremo desaparece, la relación queda interrumpida, no
  se borra.

El estado actual es el documento guardado. Los estados pasados y sus
relaciones forman un grafo dirigido acíclico que se recorre desde el
presente hacia atrás.

## Estado actual

El estado actual es el `DocumentRecord` persistido. Se guarda íntegro, con
su título, texto, kind, order, referencias y hashes. No se calcula a partir
de estados pasados. Abrir un documento no requiere reconstruir ninguna
cadena.

Consecuencia: un fallo al reconstruir el pasado no afecta al presente. El
coste de un fallo es local y acotado.

## Estados pasados

Un estado pasado es una `DocumentVersion` persistida. Tiene:

- `id`, `documentId`, `projectId`.
- `title`, `text`, `kind`, `order`: contenido propio del estado.
- `relationIds`, `tagAssignmentKeys`, `authorNoteIds`, `compositionEntryIds`:
  referencias activas en ese estado.
- `contentHash`, `referenceHash`: identidad del estado.
- `capturedAt`, `documentUpdatedAt`: metadatos del momento en que se capturó.
- `label`, `note`: metadatos opcionales del usuario.
- `pinned`: si es `true`, el estado se guarda íntegro y sirve como origen de
  nuevas rutas. Si es `false` o está ausente, el estado es un delta.
- `baseStateId`: solo en estados delta. Es el estado desde el que se calculó
  el delta. No es "padre" en una cadena: es la base de reconstrucción.
- `changes`: solo en estados delta. Cambios respecto a `baseStateId`.

Un estado delta se reconstruye aplicando `changes` sobre el estado
`baseStateId`. Si `baseStateId` apunta a un estado que ya no existe, el delta
se marca como `baseMissing: true` y no se puede reconstruir, salvo que el
usuario solicite explícitamente recalcularlo (operación fuera de la fase 1).

Un estado conservado (`pinned: true`) no depende de ningún otro estado para
reconstruirse. Es una fotografía íntegra. Sirve como origen de nuevas rutas
y como punto de conservación cuando un estado es cruce de caminos.

## Relaciones del historial

Una `VersionRelation` es una arista entre dos estados del pasado:

- `id`, `documentId`, `projectId`.
- `fromStateId`: estado de origen.
- `toStateId`: estado de destino.
- `capturedAt`: cuándo se registró la relación.
- `label`, `note`: metadatos opcionales.
- `rejected`: si es `true`, la relación se conserva pero no se muestra en la
  ruta principal. El usuario la ha marcado como "olvidada".
- `fromMissing`: `true` si `fromStateId` ya no existe.
- `toMissing`: `true` si `toStateId` ya no existe.

Una relación no apunta: indica los dos extremos de una transición. Si uno de
los extremos desaparece, la relación sigue visible, marcada como
interrumpida. La UI puede mostrar "aquí hubo una transición que ya no se
puede recorrer".

Las relaciones forman un grafo dirigido acíclico. Un ciclo es un error de
integridad y debe rechazarse al crear la relación.

## Reconstrucción

`reconstructVersion(versions, relations, targetStateId, currentDocument)`
reconstruye un estado pasado desde el estado actual hacia atrás.

Algoritmo:

1. Si `targetStateId` coincide con el estado actual (por identidad de
   `(contentHash, referenceHash)`), se devuelve el estado actual tal cual.
2. Si `targetStateId` corresponde a un estado conservado (`pinned: true`),
   se devuelve su contenido íntegro, verificando `contentHash` y
   `referenceHash`.
3. Si `targetStateId` corresponde a un estado delta, se busca el camino más
   corto desde el estado actual hasta él en el grafo de relaciones,
   prefiriendo caminos cuyos deltas estén íntegros.
4. Si un camino falla por corrupción de un delta, se prueba otro camino.
   Si ninguno funciona, se lanza un error claro indicando el estado no
   reconstruible.
5. Al final, se verifica `contentHash` y `referenceHash` del estado
   reconstruido contra los guardados. Si no coinciden, se marca como
   corrupto.

`reconstructVersion` devuelve el estado con sus referencias del pasado. El
estado de cada referencia frente al presente se calcula con
`computeReferenceStatus(state, currentReferences)`, que devuelve
`referenceStatus` con `ok` o `missing` por referencia.

## Restauración

Restaurar un estado es:

1. Reconstruir el estado objetivo con `reconstructVersion`.
2. Escribirlo como nuevo estado actual del documento (título, texto, kind,
   order). Las referencias del estado restaurado se comparan con las del
   proyecto actual: las que ya no existen se marcan como `missing` y se pide
   revisión; las nuevas creadas después no se eliminan.
3. Crear una relación "restaurado desde X" con:
   - `fromStateId`: el estado que se acaba de dejar de ser actual.
   - `toStateId`: el estado restaurado.
   - `label`: "Restaurado desde [etiqueta del hito original]".
4. No archivar, no borrar, no recalcular estados.

Restaurar no elimina relaciones, etiquetas ni notas nuevas del proyecto.
Solo reescribe el contenido propio del documento.

## Borrado

Borrar un estado solo se permite si no deja relaciones activas:

- Si el estado tiene relaciones con `fromMissing: false` y `toMissing: false`
  que lo tocan como `fromStateId` o `toStateId`, se rechaza con un mensaje
  que nombra las relaciones que se interrumpirían.
- Si el usuario quiere conservar el estado pero ocultarlo de la ruta
  principal, puede marcar las relaciones como `rejected`.
- Si se borra un estado (porque no tiene relaciones activas), las relaciones
  que lo tocaban (si las hubiera, ya marcadas como interrumpidas) quedan con
  `fromMissing` o `toMissing` correspondientes.

No hay borrado en cascada. No hay reparentado. El usuario decide.

## Identidad de un estado

Un estado se identifica por `(contentHash, referenceHash)`. Dos estados con
la misma tupla son el mismo estado, aunque se hayan capturado en momentos
distintos. Dos estados con distinto `contentHash` o distinto `referenceHash`
son estados distintos.

Consecuencia: dos relaciones pueden conectar los mismos estados si el
usuario vuelve a ellos varias veces. La secuencia temporal se conserva en
las relaciones, no en los estados.

## Lo que no cambia respecto al v0.1

- `contentHash` y `referenceHash` separados, calculados sobre JSON canónico.
- `referenceStatus` por referencia, con `ok` o `missing`.
- No resucitar referencias borradas al restaurar.
- No eliminar referencias nuevas al restaurar.
- No duplicar estados idénticos.

## Lo que se elimina respecto al v0.1

- `parentVersionId` en `DocumentVersion`.
- `CURRENT_BASE_VERSION_ID` como base sintética.
- La noción de "rama anterior" y de "archivar versiones al restaurar".
- La firma antigua de `reconstructVersion(versions, versionId, currentState)`.

## Lo que queda fuera de este documento

- La sincronización entre dispositivos.
- La resolución de conflictos cuando hay dos estados actuales en dos
  dispositivos.
- La política de fusión de ramas.
- La UI de visualización del grafo completo.

Estas decisiones se toman en fases posteriores, con pruebas verificables, y
no condicionan el formato de estados y relaciones definido aquí.