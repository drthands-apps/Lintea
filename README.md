# Lintea

Lintea es una aplicación de escritorio local para escribir y relacionar documentos, fragmentos, fichas, fuentes y notas. Está construida con React, TypeScript, Tauri y SQLite.

## Funciones disponibles

- Proyectos y documentos con persistencia local en SQLite.
- Capítulos compuestos por fragmentos independientes, con orden explícito y navegación entre ambos.
- Fichas editables para personajes, lugares, acontecimientos, historias, conceptos y otros elementos.
- Fuentes con metadatos, enlaces y citas asociables a documentos.
- Notas del autor vinculadas a elementos del proyecto.
- Etiquetas reutilizables para documentos, fichas, fuentes y notas.
- Búsqueda local por texto y metadatos, con acceso directo a los resultados.
- Historial manual de estados únicos, consulta y recuperación.

La consulta de PDF y HTML se delega al navegador o a la aplicación externa correspondiente.

## Desarrollo

Instala una versión LTS reciente de Node.js y las dependencias del proyecto:

```bash
npm install
```

Para abrir la aplicación de escritorio con persistencia SQLite:

```bash
npx tauri dev
```

`npm run dev` inicia la interfaz web con almacenamiento en memoria; los cambios no persisten al cerrar esa sesión.

## Comprobaciones disponibles

```bash
npm run typecheck
npm test
```

## Diseño y alcance

- [Documento maestro de Lintea](docs/Lintea_Documento_Maestro_v0.1.md)
- [Modelo de relaciones y composición](docs/Modelo_de_relaciones_y_composicion_v0.1.md)
- [Formato LinteaZip](docs/Formato_LinteaZip_v0.1.md)

LinteaZip cuenta con una propuesta preliminar; la importación y exportación aún no están implementadas y el formato exhaustivo se concretará tras completar el modelo de relaciones y decidir cómo representar los cambios colaborativos. El historial actual guarda estados únicos completos; la comparación visual y el almacenamiento por cambios están pendientes.
