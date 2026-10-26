# Lintea — núcleo técnico inicial

Esta carpeta contiene una primera prueba del núcleo de Lintea, no todavía la aplicación de escritorio ni la persistencia real en SQLite.

## Qué demuestra

- Los documentos y fragmentos tienen identificadores estables.
- Las relaciones apuntan a identificadores, no a títulos que pueden cambiar.
- Un anclaje conserva el texto seleccionado y contexto cercano.
- Si el texto seleccionado sigue siendo único, se puede localizar tras editar otras partes del documento.
- Si el texto desaparece o aparece en varios lugares y no hay contexto suficiente, la función devuelve un resultado no resuelto en lugar de adivinar silenciosamente.

## Requisitos

Instala una versión LTS reciente de Node.js. npm viene incluido.

## Ejecutar las pruebas

Abre una terminal en la carpeta que contiene `package.json` y ejecuta:

```bash
npm install
npm test
npm run typecheck
```

Las pruebas no guardan datos en disco todavía. Validan reglas del núcleo en memoria.

## Archivos

- `src/core/model.ts`: tipos y creación de relaciones.
- `src/core/anchors.ts`: anclajes de fragmentos y resolución tras una edición.
- `tests/anchors.test.ts`: pruebas del comportamiento de los anclajes.
- `tests/model.test.ts`: pruebas del modelo de relaciones.

## Importante

Esta prueba usa un identificador sencillo generado con `crypto.randomUUID()`. En entornos donde no esté disponible, deberá inyectarse un generador de identificadores compatible. La siguiente etapa será validar el modelo, crear una capa de persistencia y guardar el proyecto en SQLite. No conectes aún datos importantes: esto es un prototipo.
