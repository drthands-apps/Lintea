# Formato portable LinteaZip 0.1

Esta es una propuesta inicial para explorar la portabilidad, no un formato cerrado ni la especificación exhaustiva de la exportación definitiva. El esquema se revisará después de completar el modelo de relaciones y decidir qué historial y metadatos de colaboración deben conservarse.

LinteaZip es el formato abierto para exportar, respaldar, compartir y recuperar un proyecto completo de Lintea. Es un ZIP estándar con la extensión `.ltz`, que se puede abrir con cualquier descompresor ZIP. La aplicación puede seguir trabajando sobre SQLite; el archivo portable no sustituye la base de trabajo activa.

## Estructura

```text
mi-proyecto.ltz
├── manifest.json
├── project.json
├── documents.json
├── content/
│   └── <document-id>.<original-extension>
├── fragments.json
├── fragments/
│   └── <fragment-id>.<original-extension>
├── entities.json
├── sources.json
├── notes.json
├── relations.json
├── composition.json
├── assets/
│   └── <asset-id>/<filename>
├── assets.json
└── versions/
    └── <document-id>/<version-id>.json
```

Los índices JSON contienen metadatos e identificadores estables. Los documentos y fragmentos que forman parte de la obra de la persona declaran ruta, formato y tipo MIME. El paquete admite formatos abiertos y comunes para esos contenidos, además de imágenes y otros recursos que la persona decida incorporar.

Un fragmento tiene un único archivo fuente. Incorporarlo a capítulos crea referencias de composición y no copias divergentes del texto.

## Archivos principales

- `manifest.json`: identifica el formato, su versión, el identificador del proyecto y las rutas que forman el paquete.
- `project.json`: título, fechas y contexto del proyecto.
- `documents.json`: documentos, rol (`chapter` o `note`), título, fechas, formato/ruta del contenido y orden explícito de capítulos.
- `fragments.json`: fragmentos independientes, títulos, fechas y formato/ruta del contenido.
- `entities.json`: fichas de personajes, lugares, historias, acontecimientos, conceptos y otras entidades; incluye atributos flexibles, enlaces externos etiquetados y orden manual.
- `sources.json`: referencias bibliográficas y externas, con autor, título, fecha, editorial, DOI, URL, cita/localizador y orden manual. La referencia no exige incluir una copia del material consultado; los adjuntos son opcionales y solo se añaden cuando la persona lo decide.
- `notes.json`: notas privadas del autor, su vínculo opcional con un elemento del proyecto y su orden manual.
- `relations.json`: vínculos tipados entre documentos, fragmentos, fichas y fuentes. Las citas son relaciones con una fuente; pueden incluir un anclaje a un pasaje del texto.
- `composition.json`: capítulos y fragmentos que los componen, con posiciones explícitas. Un fragmento puede aparecer en varios capítulos.
- `assets/` y `assets.json` (opcionales): imágenes u otros recursos que la persona elija guardar dentro del proyecto, con nombre original, formato MIME, tamaño y hash para comprobar su integridad.
- `versions/`: historial recuperable de documentos; no se aplana en la versión actual.

Las referencias bibliográficas guardan metadatos, URL y localizadores; no descargan ni incorporan automáticamente la obra consultada. Lintea no necesita ser lector ni editor de PDF o HTML: esos materiales pueden abrirse con el navegador o la aplicación externa correspondiente. Las citas, notas e imágenes que la persona quiera conservar en el proyecto son datos propios y pueden formar parte del paquete.

## Identidad y relaciones

Los IDs no dependen del nombre del archivo, título, ruta u orden. Todas las referencias cruzadas usan IDs. Un anclaje a texto guarda el documento, la cita y contexto cercano; un anclaje que no se resuelva con confianza se conserva como pendiente de revisión.

Ejemplo de relación:

```json
{
  "id": "rel-uuid",
  "from": { "type": "fragment", "id": "fragment-uuid" },
  "to": { "type": "source", "id": "source-uuid" },
  "kind": "supported_by",
  "note": "Referencia para la fecha mencionada",
  "anchor": {
    "documentId": "chapter-uuid",
    "quote": "el pasaje anclado",
    "prefix": "contexto anterior",
    "suffix": "contexto posterior"
  }
}
```

Ejemplo de composición:

```json
{
  "chapters": [
    {
      "documentId": "chapter-uuid",
      "order": 0,
      "fragments": [
        { "fragmentId": "fragment-uuid", "order": 0 }
      ]
    }
  ]
}
```

## Versionado y compatibilidad

Todo paquete declara `formatVersion` en `manifest.json`. Un importador valida la versión, JSON, IDs y referencias antes de aplicar cambios. Versiones desconocidas no se abren silenciosamente. Las exportaciones posteriores pueden añadir campos opcionales compatibles; cambios incompatibles requieren una versión mayor del formato y una migración documentada.

La exportación incluye el proyecto completo. La persona puede inspeccionar y recuperar los Markdown y JSON con herramientas comunes aunque Lintea no esté instalado.

