# Lintea: relaciones y composición de la obra

Documento de decisión para orientar la siguiente etapa del prototipo.

El paquete portable del proyecto se especifica en [Formato LinteaZip 0.1](Formato_LinteaZip_v0.1.md).

## Idea central

Lintea trabaja con materiales que mantienen identidad propia y pueden conectarse o componerse de distintas maneras. El sistema debe separar dos operaciones que conviven en el mismo proyecto:

- **Relacionar:** expresar cómo se conectan un texto, un fragmento, una ficha o una fuente.
- **Componer:** decidir qué fragmentos forman parte de un capítulo y en qué orden aparecen los capítulos.

Una relación no cambia por sí misma la ubicación ni el texto de sus elementos. La composición tampoco debe borrar la procedencia de un fragmento.

## Elementos del proyecto

- **Documento:** unidad de escritura que puede ser capítulo, nota o fragmento independiente.
- **Fragmento:** pieza breve con identidad estable. Puede nacer como material suelto y luego incorporarse a uno o varios capítulos.
- **Ficha:** personaje, lugar, acontecimiento, concepto, persona u organización con información descriptiva.
- **Fuente:** referencia bibliográfica o material consultado, con autoría, enlace y cita.
- **Relación:** vínculo tipado entre elementos; por ejemplo, menciona, participa en, sucede en, está sustentado por, contradice, se inspira en o forma parte de.
- **Composición:** lista ordenada de fragmentos que forman un capítulo. El orden de capítulos pertenece a la estructura del manuscrito, no a sus fechas de creación.

Los identificadores se mantienen aunque cambien los títulos o la posición. Los anclajes a pasajes concretos guardan cita y contexto; si no se pueden resolver con confianza, requieren revisión manual.

## Granularidad y sentido de los vínculos

Un vínculo a un capítulo completo puede resultar demasiado amplio, sobre todo cuando el manuscrito crece. Cuando la relación se refiera a una parte concreta, debe poder señalar un pasaje y regresar directamente a él; el vínculo debe mostrar una cita o extracto contextual, su tipo y, cuando haga falta, una nota del autor que explique por qué importa. La misma ficha o fuente puede relacionarse varias veces con un documento si cada vínculo corresponde a un pasaje o sentido distinto; cada relación conserva su propio anclaje y explicación. Una ficha o fuente conectada únicamente al capítulo no debe sugerir que todo el capítulo trata de ella.

Las etiquetas sirven para agrupar temas o estados que atraviesan distintos tipos de elementos. Por sí solas no explican qué relación existe. Para encontrar una referencia útil dentro de un documento largo, el resultado debe poder indicar el pasaje, mediante un fragmento independiente o un anclaje estable a texto seleccionado. Las etiquetas de pasaje ya reutilizan anclajes de cita y contexto; no guardan solamente índices de caracteres que se vuelvan incorrectos al editar.

Regla de diseño: separar la clasificación amplia (etiqueta), el vínculo semántico (relación tipada), la explicación del autor (nota de relación) y la localización precisa (anclaje o fragmento). La interfaz debe presentar esas cuatro piezas juntas cuando aporten contexto, sin obligar a rellenarlas todas para cada vínculo.

En el prototipo, las etiquetas pueden aplicarse al elemento completo o a un pasaje seleccionado. Las asignaciones de pasaje guardan la cita y su contexto cercano en un registro separado, de modo que siguen siendo distintas de las etiquetas generales y se conservan al volver a abrir el proyecto. Este anclaje es una referencia interna recuperable, no un `id` HTML ligado a una posición fija. Al elegir un resultado de búsqueda de pasaje etiquetado, Lintea abre directamente el documento y selecciona el texto; muestra la cita en la pantalla principal como confirmación y permite volver a seleccionarla. Los controles de etiqueta del panel contextual asignan o quitan etiquetas; no navegan. Si, después de editar, la cita ya no aparece o el contexto no permite distinguirla con seguridad, Lintea abre el documento y pide revisar el pasaje en vez de elegir otro automáticamente. Los vínculos de fichas y fuentes también pueden guardar una selección de texto, volver a ella y conservar una nota explicativa editable; la nota aparece en los usos listados desde el catálogo.

## Primer recorrido de uso

1. Crear un fragmento independiente sin decidir todavía su capítulo.
2. Relacionarlo con una ficha y, cuando corresponda, con una fuente.
3. Crear o elegir un capítulo e incorporar el fragmento como una pieza con identidad propia.
4. Reordenar los capítulos explícitamente.
5. Volver desde el capítulo al fragmento original y consultar sus relaciones.

La interfaz presenta estos elementos de forma contextual y plegable para mantener el texto como centro de la escritura.

## Vistas anexas y navegación de vuelta

El anexo de personajes, lugares, historias y otras fichas es un catálogo/vista de los registros del proyecto, no un segundo documento con datos copiados. Cada ficha se edita en un único lugar y admite secciones flexibles según su clase: por ejemplo, personalidad, aspecto, motivaciones e historia para un personaje; localización, rasgos y referencias para un lugar. Así pueden añadirse campos útiles sin forzar una plantilla rígida.

Las fichas admiten enlaces externos etiquetados (por ejemplo, Wikipedia, mapas o páginas web) y relaciones internas tanto con documentos y fuentes como con otras fichas. Estas relaciones entre fichas permiten expresar, por ejemplo, participación en acontecimientos, lugares donde ocurren o vínculos conceptuales; cada una conserva su tipo y una nota explicativa opcional. Las fuentes también se pueden relacionar directamente con fichas para registrar qué entidad mencionan, contradicen, sustentan o inspiran. Desde los catálogos se puede abrir el elemento conectado, editar la nota o retirar el vínculo. La interfaz distingue vínculos directos con un capítulo de los capítulos alcanzados a través de un fragmento incluido, y evita duplicarlos en la lista.

Las fuentes forman otro catálogo anexado al proyecto. Cada registro puede reunir metadatos bibliográficos, DOI/URL, cita o localizador. Los materiales consultados se abren con el navegador o la aplicación externa correspondiente; Lintea no asume la lectura ni la edición interna de PDF o HTML. Guardar una copia dentro del proyecto es opcional. El texto citado puede anclarse a un pasaje; el fragmento y la fuente siguen siendo registros independientes.

Las notas del autor son tarjetas breves tipo sticker, opcionalmente vinculadas al proyecto, documento, fragmento, ficha o fuente. Deben poder consultarse desde el elemento relacionado y desde el espacio de notas del proyecto. Su contenido no se mezcla con el manuscrito salvo que la persona lo incorpore expresamente.

## Etiquetas y búsqueda

Las etiquetas son registros reutilizables del proyecto, con identificadores propios. Una etiqueta puede aplicarse a varios documentos, fichas, fuentes o notas; cambiar su nombre conserva todas las asignaciones. El mismo nombre normalizado no se duplica dentro del proyecto. Eliminar una etiqueta retira sus asignaciones, pero nunca elimina los elementos etiquetados.

La búsqueda inicial es literal y local. Recorre títulos y contenido de documentos, campos de fichas, metadatos de fuentes, texto de notas y nombres de etiquetas. Los términos se comparan sin distinguir mayúsculas ni acentos; todos los términos escritos deben aparecer en el resultado. Los resultados priorizan coincidencias en el título y permiten abrir el registro original. El índice de búsqueda se reconstruye al cambiar los datos del proyecto y se reutiliza mientras se escribe la consulta.

Un fragmento indica siempre si no está incluido en ningún capítulo o enumera todos sus capítulos. La inclusión es una relación de composición reversible y no impide que la misma pieza aparezca en varios lugares.

## Organización y reasignación

Las listas y bloques de las vistas anexas deben poder plegarse y reordenarse a voluntad. El orden debe conservarse en el proyecto y no depender de fechas, títulos ni del orden en que se crearon los registros.

Fichas, fuentes y notas pueden reasignarse a otros fragmentos o capítulos. Cambiar una asociación edita el vínculo; no crea una copia del elemento ni borra su historial. Las inclusiones de fragmentos en capítulos se pueden añadir, quitar y reordenar independientemente. La interfaz debe mostrar los usos directos y los heredados para que la reasignación sea comprensible.

## Reglas de integridad

- Incorporar un fragmento no elimina ni duplica su registro original.
- La misma pieza puede aparecer en más de un capítulo; cada inclusión tiene su propio orden dentro del capítulo.
- Reordenar capítulos o piezas no modifica fechas, identificadores ni relaciones.
- Las citas distinguen la fuente de la afirmación o fragmento que respaldan.
- Ninguna relación se mueve silenciosamente si un anclaje deja de ser fiable.
- Las operaciones de composición deben poder deshacerse o recuperarse mediante el historial.

Las relaciones tienen identidad propia y extremos dirigidos (`from` y `to`); su clase está tipada por un catálogo canónico compartido con la interfaz. Ambos extremos deben pertenecer al mismo proyecto. Las fichas, incluidos los acontecimientos, usan el tipo de extremo `entity`; `event` se acepta temporalmente para datos antiguos y se normaliza al crear una relación o guardar la ficha relacionada. Un anclaje solo puede apuntar a un documento o fragmento que sea extremo de esa relación y del mismo proyecto. No se prohíben varias relaciones entre los mismos elementos si tienen sentidos, notas o pasajes distintos. El núcleo no impone todavía una matriz rígida de tipos permitidos: `participates_in` y `occurs_at`, por ejemplo, suelen conectar clases concretas de ficha, pero el uso debe informar antes de cerrar esas restricciones. Al exportar, se conservarán el sentido, tipo, identidad, nota y anclaje de cada relación.

## Guardado y copias del proyecto

El estado del almacenamiento permanece visible en la barra superior. El documento se guarda al salir del campo de edición; las fichas, fuentes y notas tienen acciones de guardado en sus propios formularios. Las acciones de alcance de proyecto —crear una copia externa, exportar, importar y recuperar una salvaguarda— se agruparán en el menú del proyecto, junto al selector de proyectos. Una salvaguarda debe crear un archivo externo recuperable; no debe confundirse con el guardado ordinario en la base de trabajo. No se ofrecerá un botón global «Guardar todo» hasta que pueda incluir y confirmar todos los cambios pendientes de cada vista. En escritorio las operaciones se escriben en SQLite; en la vista de navegador de desarrollo el almacenamiento actual es temporal y debe indicarse como tal.

## Alcance gradual

La primera entrega debe cubrir el recorrido de extremo a extremo con fragmentos, capítulos, fichas y fuentes, relaciones guardadas localmente y orden explícito. La comparación visual de versiones, las líneas temporales complejas, los tableros y la personalización por skins quedan fuera de este primer corte.

El almacenamiento activo de escritorio sigue en SQLite. La exportación/importación LinteaZip debe poder reconstruir los elementos, relaciones, composición y versiones con sus IDs, sin copiar el texto de un fragmento al incorporarlo a un capítulo.

