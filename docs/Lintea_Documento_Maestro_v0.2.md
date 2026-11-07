# LINTEA

**Documento maestro de visión, principios, producto y plan técnico**

Versión 0.1 · Documento de trabajo · 26 de octubre de 2026

> Documento de referencia vivo. Actualizarlo cuando cambien decisiones importantes.


## 1. Propósito y visión

Lintea es una mesa de trabajo local-first para escribir, investigar, documentar y relacionar conocimiento. No busca escribir en lugar de las personas, sino ayudarlas a recordar, conectar, comprender, comprobar y perfeccionar aquello que quieren escribir.

El texto no vive aislado: forma parte de un conjunto de ideas, referencias y decisiones que el usuario puede consultar mientras trabaja.

Principio rector: «No construir un programa que escriba por las personas, sino uno que les permita recordar, relacionar, comprender y perfeccionar todo aquello que quieren escribir».


## 2. Horizonte ideológico y principios

Autoría y control: la persona que crea una obra conserva el control sobre ella. Usar Lintea no transfiere al programa derechos sobre los documentos del usuario. La licencia del software y los derechos sobre el contenido son asuntos distintos.

La herramienta no es el autor. La asistencia es opcional; las decisiones creativas y editoriales corresponden al usuario.

Privacidad por diseño: las funciones esenciales deben funcionar localmente, sin cuenta, suscripción, conexión permanente ni servidor mantenido por el proyecto. Si una función externa requiere enviar contenido, debe identificar qué se envía y a quién, y pedir autorización clara.

Transparencia y reversibilidad: las sugerencias automáticas no sobrescriben el original sin aprobación explícita. El usuario puede revisar, aceptar, rechazar o deshacer cambios. Se distinguen hechos, fuentes, citas, hipótesis, opiniones y sugerencias.

Libertad y portabilidad: priorizar software libre, formatos abiertos, documentación pública y exportación completa.

Honestidad técnica: las alertas de coherencia son pistas para revisar, no verdades definitivas. La ausencia de alertas no garantiza que el contenido sea correcto.


## 3. Público objetivo y usos

Público principal: escritores de ficción y no ficción, ensayistas, investigadores independientes, estudiantes, periodistas, divulgadores, guionistas y personas que trabajan con grandes cantidades de información relacionada.

Ficción: personajes, lugares, acontecimientos, líneas temporales, continuidad, reglas del mundo, escenas, notas, versiones y referencias visuales.

Investigación y no ficción: fuentes bibliográficas, citas, documentos, notas de lectura, afirmaciones, evidencias, hipótesis, fechas y relaciones entre materiales.

Escritura profesional o documental: documentación de proyectos, informes, materiales de referencia e historial de decisiones.

La aplicación no debe dar por sentado que todos escriben novelas. El mismo modelo fundamental debe servir para distintos tipos de proyecto.


## 4. Experiencia de uso y diseño

Limpia y serena: la interfaz debe parecer una mesa de trabajo, con jerarquía clara, poco ruido visual, controles reconocibles y espacio para leer y escribir.

El texto es el centro. El editor ocupa la mayor parte del espacio. El panel contextual muestra relaciones, fuentes, cronología y notas del fragmento activo, y se puede contraer.

Contexto disponible: desde un fragmento se consultan personajes, lugares, fechas, hechos, referencias, notas y otros fragmentos relacionados sin perder el hilo de escritura.

Vistas complementarias: el tablero visual representa el mismo conocimiento, no una copia. Debe coexistir con búsqueda, listas, fichas, cronología y vistas de documento.

Revelación progresiva: mostrar primero lo necesario y reservar funciones avanzadas para cuando se soliciten.

Accesibilidad: contemplar navegación por teclado, contraste, escalado de texto, distintos tamaños de ventana e internacionalización, empezando por español.


## 4.1. Decisiones de producto derivadas del análisis de la competencia

Tras evaluar herramientas como Bibisco, yWriter, Campfire y Tintero, se han fijado las siguientes decisiones para la experiencia de Lintea, buscando siempre la coherencia con los principios del proyecto:

El texto siempre es el centro (WYSIWYG estricto).
Las vistas separadas de "escritura" y "lectura" son un residuo de herramientas antiguas. Lintea debe ofrecer un único editor semántico donde el formato se aplica en tiempo real. La interfaz no debe ocultar el texto detrás de paneles excesivos ni de utilidades de escritura recargadas; debe ser discreta, permitiendo que la persona se concentre en redactar.

Contexto flotante, no invasivo.
A diferencia de otras aplicaciones donde abrir una ficha o un personaje te saca de la pantalla de escritura, Lintea apuesta por un panel contextual lateral (o ventanas flotantes) que permiten consultar la información mientras se escribe. La información no debe secuestrar la pantalla; debe acompañar al texto.

Creación contextual inmediata (menú de clic derecho).
Se integrará un menú contextual en el editor. Al seleccionar un fragmento de texto y hacer clic derecho, la persona podrá crear una ficha (personaje, lugar, objeto o idea) y enlazarla automáticamente a ese pasaje específico en un solo paso. Esta eliminación de la fricción (no tener que ir a la barra lateral, crear la ficha, volver al texto y buscar el pasaje) es un valor diferencial frente a la competencia.

Fichas exhaustivas pero flexibles.
Frente a las fichas rígidas (Bibisco) o excesivamente esquemáticas (yWriter), Lintea ofrece un sistema de plantillas sugeridas pero editables. Un personaje puede tener Biografía, Psicología y Motivaciones, o solo una nota caótica; el usuario decide la profundidad. Las fichas incluirán soporte para imágenes (como avatares o referencias visuales), y cada una mostrará su "contexto" (todos los puntos de la obra donde aparece, distinguiendo vínculos directos de los heredados).

Estructura de la obra y guía literaria.
No habrá asistentes de creación guiada (wizards) que impongan metodologías. El proyecto se define con un título y, opcionalmente, un género. Para la estructura, el Tablero de conexiones será la herramienta principal, permitiendo visualizar los hilos argumentales, las subtramas y cómo convergen los fragmentos. Se evitarán las etiquetas de estado impuestas (como "primera/tercera persona") para dejar paso a etiquetas semánticas creadas por el usuario (ej. "hilo A", "revisar", "investigar").

Transparencia radical y cero fricción legal.
Otras herramientas saturan con múltiples pantallas de aceptación de términos y condiciones, lo que genera desconfianza. Lintea debe ser transparente: sin telemetría oculta, sin cuentas obligatorias y con una política de privacidad clara y breve. El software debe ser de código abierto y local-first, de modo que la persona nunca sienta que su manuscrito está retenido.

## 5. Capacidades previstas

Núcleo: proyectos, documentos, fragmentos identificables, notas, etiquetas, búsqueda, guardado fiable y recuperación.

Estado actual del núcleo: proyectos y documentos se guardan en SQLite en la aplicación de escritorio; capítulos y fragmentos se componen mediante inclusiones ordenadas; fichas, fuentes y notas admiten relaciones y navegación; las etiquetas pueden asignarse a elementos completos o a pasajes seleccionados con anclajes de cita y contexto, y la búsqueda puede abrir el pasaje etiquetado cuando localiza su cita con seguridad. Las etiquetas siguen siendo independientes de las versiones del documento. Las versiones permiten guardar estados únicos y recuperarlos. El almacenamiento por deltas, la comparación visual y la recuperación parcial siguen pendientes.

Conocimiento relacionado: fichas de personajes, lugares, conceptos, acontecimientos, hechos, cronologías, fuentes, anotaciones, hipótesis, imágenes y vínculos tipados.

Panel contextual: relaciones del fragmento activo, fuentes citadas, eventos temporales, notas asociadas y acceso a fichas relevantes.

Biblioteca de referencia: materiales propios, referencias externas, metadatos bibliográficos, enlaces, citas y notas de lectura. Las fuentes pueden abrirse en el navegador o la aplicación externa correspondiente; Lintea no necesita incorporar un lector/editor PDF o HTML ni guardar una copia de cada obra consultada. Las citas, notas e imágenes que la persona quiera conservar sí forman parte del proyecto.

Biblioteca lingüística y de consulta: catálogo integrable, organizado por idioma y variedad, que reúna enlaces a diccionarios generales y especializados, ortografía, sinónimos, tesauros semánticos, gramáticas, manuales de estilo, corpus de uso, terminología y obras de consulta. La persona debe poder consultar un recurso desde el texto seleccionado y, cuando resulte útil, conservar la referencia o el vínculo como fuente del proyecto. Lintea no aloja ni reproduce por defecto el contenido de estos recursos.

Biblioteca abierta: facilitar la localización de obras de dominio público y publicaciones con acceso abierto, además de permitir que cada persona añada sus propios recursos. La aspiración es favorecer el conocimiento como bien común, respetando el estado jurídico efectivo de cada obra. Distinguir siempre entre acceso gratuito, acceso abierto y permiso para copiar, citar, redistribuir o adaptar. Registrar idioma, proveedor, URL, atribución, licencia o condiciones conocidas, usos permitidos y restricciones, enlace al texto aplicable y fecha de comprobación; marcar como desconocidos los derechos que no se hayan podido verificar. Solo incluir copias descargables cuando los derechos y términos del recurso lo permitan.

Responsabilidad sobre derechos: Lintea debe mostrar de forma clara la información y las advertencias disponibles, enlazar a las condiciones originales y evitar presentar el acceso gratuito como permiso de reutilización. La persona decide si su uso concreto está autorizado, atendiendo también a las excepciones legales aplicables; Lintea debe procurar que esa decisión se tome con información fiable y no sustituirla por una garantía automática.

Catálogos anexos: vistas editables y enlazadas de personajes, lugares, historias, conceptos y otras fichas; referencias bibliográficas y notas del autor tipo tarjeta. Cada dato tiene un registro fuente único. Las fichas admiten atributos apropiados a su tipo y enlaces externos. Desde ellas se navega a fragmentos y capítulos, distinguiendo vínculos directos de los heredados a través de un fragmento.

Tablero de conexiones: tarjetas, relaciones visuales, filtros por tipo, varios tableros por proyecto y navegación hacia los elementos originales.

Cronología: eventos ordenados por fecha o intervalo, con vínculos a documentos, personajes, fuentes y acontecimientos. Debe admitir fechas aproximadas o desconocidas.

Versiones y comparación: historial recuperable, comparación de cambios y restauración explícita.

Búsqueda: texto literal, metadatos, tipos de elemento y relaciones; más adelante, búsqueda semántica, sin sustituir la búsqueda exacta.

Revisión de coherencia: detección asistida de posibles contradicciones, nombres o fechas inconsistentes y referencias sin fuente. Mostrar evidencia y dejar la decisión al usuario.

IA opcional: corrección, opinión estilística, comparación de versiones, revisión de coherencia y apoyo bibliográfico. Explicar el contexto utilizado y los límites; nunca será obligatoria.

Herramientas externas: conectar recursos lingüísticos, catálogos bibliográficos, repositorios, correctores y visualizadores mediante API cuando convenga; de lo contrario, ofrecer enlaces y apertura externa. Los catálogos deben poder ampliarse por idioma, variedad y disciplina sin exigir que Lintea mantenga una biblioteca propia de obras protegidas.

Importación y exportación: formatos comunes para manuscritos (por ejemplo, Markdown, HTML, DOCX y ODT cuando sea viable) y exportación completa del proyecto, con relaciones, notas y recursos. Un manuscrito no equivale al proyecto completo.

Propuesta inicial de formato portable LinteaZip: paquete `.ltz` basado en ZIP estándar, inspeccionable con herramientas comunes. Un manifiesto versionado identifica el proyecto y sus archivos; los índices JSON conservan IDs, relaciones, referencias y orden de composición. Los contenidos propios pueden usar formatos comunes como Markdown, HTML, XML, DOCX u ODT. Las fuentes externas se guardan como referencias con URL y localizador, sin exigir copias locales; los recursos opcionales que la persona decide incluir conservan su formato original. La propuesta no se considera exhaustiva ni cerrada hasta completar el modelo de relaciones y decidir qué historial y metadatos de colaboración exportar.

### Dirección de interfaz y edición

La aplicación debe ofrecer un mapa reconocible de sus funciones antes de profundizar en herramientas avanzadas. El panel contextual concentra información y controles relacionados con el proyecto y el elemento actual; sus secciones y las áreas de navegación laterales podrán reordenarse para que cada persona priorice su flujo. La ayuda extensa abre una página de lectura cómoda; el panel puede conservar un resumen y el recordatorio de atajos. «Acerca de Lintea» presenta el propósito y el estado del producto sin atribuir datos de autoría aún no acordados.

Separar dos sistemas visuales. La **skin del texto** es un paquete importable, prediseñado y no editable dentro de Lintea: contiene manifiesto, CSS y recursos asociados (por ejemplo, tipografías con sus licencias). Define conjuntamente familias y tamaños de texto, jerarquías de títulos, colores, formato de página, márgenes e interlineado. Se instala en la carpeta de skins de la persona; el proyecto elige una skin instalada y conserva su identificador y versión. La **skin de interfaz** controla solo la aplicación (por ejemplo, claro u oscuro) y es una preferencia de uso, independiente de la presentación del manuscrito. La licencia de cada recurso se conserva y se verifica antes de redistribuirlo en una copia del proyecto.

La barra de edición debe operar sobre estructura semántica —párrafos, títulos, listas, énfasis, subíndices, notas, referencias e imágenes— y presentar esa estructura mediante la skin elegida. La skin no debe convertir el manuscrito en una imagen ni mezclar formato de presentación con contenido. Antes de sustituir el texto plano actual por un editor enriquecido, definir cómo se migran los documentos existentes, se representan los recursos y se conservan los anclajes, el historial y la exportación. Los comandos habituales incluyen deshacer/rehacer, cortar/copiar/pegar y selección; se habilitan según el contexto y el portapapeles.

Propuesta de base para el editor: guardar contenido como HTML semántico validado y versionado, sin estilos en línea; usar una proyección de texto plano para búsqueda, recuentos y recuperación de anclajes. Los documentos actuales se interpretan como texto plano y se migran a párrafos sin alterar su lectura. Los anclajes guardan cita y contexto de esa proyección, no offsets en el HTML. Las imágenes se almacenan como recursos del proyecto con ID estable y el contenido las referencia por ID. El editor debe aislar la biblioteca que use tras un adaptador para no exportar su formato interno como formato canónico. Antes de fijar esta propuesta, hacer una prueba pequeña que confirme que selección, pegado, undo/redo, anclajes, búsqueda y migración se conservan.

Paquete propuesto para una skin de texto: directorio identificable con `manifest.json`, hoja CSS y carpeta opcional de recursos. El manifiesto declara nombre, versión, formatos de página admitidos, recursos incluidos y licencias. La importación instala el paquete en la carpeta de datos de usuario; Lintea ofrece vista previa, activación y retirada, pero no edición del CSS. El proyecto almacena el ID y la versión elegida. Los paquetes instalados y sus dependencias se incluirán en la salvaguarda cuando la licencia permita redistribuirlos; en otro caso se guardará la referencia y se advertirá que habrá que instalar la skin para reproducir la vista exacta.

La búsqueda del proyecto debe mostrar coincidencias con contexto, tipo y ubicación, y llevar a la coincidencia exacta en el documento cuando sea posible; los anclajes que ya existen son el punto de partida, no un sustituto de encontrar texto literal. El recuento podrá alternar entre caracteres, palabras y páginas calculadas según la skin/formato activo; el cálculo de páginas se presenta como estimación hasta la vista de impresión.

Los documentos podrán incluirse o excluirse de perfiles de publicación y reordenarse para crear una salida completa sin alterar la estructura de trabajo. La salida puede generar automáticamente tabla de contenidos e índices elegidos por la persona; debe distinguir el proyecto íntegro del manuscrito publicado y conservar las relaciones en la salvaguarda completa.

Preferencias iniciales para diseñar: skin del texto; tema de interfaz; corrección automática activada/desactivada; visibilidad de contadores y tipo de recuento; orden de paneles/secciones. Las preferencias visuales se aplican en conjunto mediante presets y no exponen controles para editar CSS dentro de Lintea.


## 6. Modelo conceptual de datos

Entidades iniciales: Project, Document, Fragment, Entity, Source, Relation, Annotation, Event, CompositionEntry, Tag, TagAssignment y Version. Se pueden ajustar, pero los identificadores estables son fundamentales.

La composición es explícita: capítulos ordenados y piezas con IDs estables. Incorporar un fragmento no crea una copia divergente ni destruye su origen. Las relaciones describen significado, menciones, citas y evidencia; no sustituyen el orden de composición.

Cada objeto tiene un identificador independiente de su título o contenido. Las relaciones guardan origen, destino, tipo y metadatos. Ejemplos: «menciona», «participa en», «ocurre en», «sustentado por», «contradice» o «relacionado con».

No identificar fragmentos solo por posiciones de caracteres. Usar identificadores estructurales y anclajes con texto de referencia y contexto cercano para intentar recuperarlos tras una edición. Si la confianza es baja, marcar el vínculo para revisión.

Editor, panel contextual, cronología y tablero son vistas del mismo conjunto de datos, evitando copias divergentes.

El esquema y el formato de proyecto deben versionarse y documentarse.


## 7. Arquitectura y tecnología

Estrategia: monolito modular, no una colección prematura de ejecutables ni un bloque de código sin límites. El núcleo debe probarse sin interfaz gráfica, base de datos o IA.

Interfaz: TypeScript + React; Vite para desarrollo. Escritorio: Tauri como contenedor previsto. Persistencia: SQLite local. Pruebas: Vitest para la lógica TypeScript.

Windows primero, con diseño preparado para Linux y macOS. Las dependencias específicas del sistema operativo se aíslan en la capa de escritorio.

Se puede estudiar una versión web en el futuro sin prometerla ni asumir ahora costes de alojamiento. Compartir TypeScript no elimina las diferencias de almacenamiento, permisos y ejecución entre navegador y escritorio.

Módulos previstos: core, storage, editor, library, relations, timeline, versions, search, import-export, integrations, AI (opcional) y desktop. No hace falta implementarlos todos desde el primer día.

Regla de dependencias: core no importa React, SQLite, Tauri ni SDK de IA. Las integraciones deben poder sustituirse o desactivarse.


## 8. Privacidad, licencias y sostenibilidad

Objetivo: software libre y gratuito, con licencia de código abierto por decidir tras revisar necesidades de contribución y compatibilidad. No declarar licencia hasta comprobar dependencias y tomar la decisión expresamente.

La licencia del código no concede automáticamente derechos sobre las obras del usuario. Explicar que conserva el control de su contenido, sujeto a leyes y licencias de materiales externos.

Revisar licencias de dependencias, iconos, fuentes, bibliotecas de exportación y recursos incluidos; mantener avisos e inventario.

Sostenibilidad posible: contribuciones comunitarias, donaciones o patrocinio voluntario, sin bloquear funciones esenciales tras una suscripción.

Sin telemetría por defecto. Los datos de proyectos no se comparten con servicios externos sin una acción clara del usuario.


## 9. Plan por fases

La secuencia prioriza primero un núcleo local fiable y un modelo amplio de relaciones; después, la colaboración entre dispositivos; y solo entonces, cerrar el formato de intercambio para que represente fielmente el proyecto. El orden es orientativo y debe revisarse con el uso real.

Fase 0 — Fundamentos y prueba de concepto: documentar el modelo, los identificadores estables y los anclajes; probar recuperación tras editar y registrar decisiones pendientes sin fijar tecnologías antes de tiempo.

Fase 1 — Núcleo local y flexible: proyectos, documentos, fragmentos, notas, etiquetas, guardado fiable, búsqueda y edición básica. Mantener la arquitectura abierta a nuevos tipos de relación y necesidades que aparezcan al usar la aplicación.

Fase 2 — Relaciones completas: terminar fichas, fuentes, vínculos tipados, anclajes, notas explicativas, composición, navegación, cronología y vistas contextuales. Definir qué estados del historial abarcan relaciones y anotaciones, y cómo se recuperan.

Fase 3 — Historial de cambios y colaboración: diseñar y probar cambios identificables que puedan mostrarse en distintos terminales, conservar autoría y contexto, propagarse sin perder trabajo y permitir revisión o recuperación. Comparar sincronización mediante servidor intermedio, P2P y opciones híbridas. Resolver primero requisitos de trabajo sin conexión, concurrencia, conflictos, privacidad y permisos; no se elige aún un transporte ni se presupone edición simultánea carácter a carácter.

Fase 4 — Exportación e importación exhaustivas: fijar el formato del proyecto después de conocer sus relaciones, recursos, versiones, autoría y cambios colaborativos. Debe poder reconstruir el contenido y las conexiones sin pérdida; la exportación de manuscrito será una vista derivada del proyecto completo.

Fase 5 — Completar interfaz y herramientas: editor semántico y skins, preferencias, ayuda, atajos, navegación reordenable, selección para publicación, índices automáticos y contadores. Profundizar después la revisión de coherencia, biblioteca avanzada, tablero, funciones de apoyo e integraciones o IA opcionales con consentimiento, guiadas por el uso observado.

Fase 6 — Calidad y publicación: accesibilidad, pruebas de regresión, migraciones, copias de seguridad, gestión segura del ciclo de vida de proyectos (incluida su eliminación explícita), instaladores, documentación, guía de contribución, licencias y publicación.

La interfaz y la edición básica deben ser útiles y coherentes antes de dar por cerrada la fase de herramientas. Lintea no pretende competir con procesadores especializados: debe facilitar redactar y organizar el texto, dejando que las relaciones y el contexto aporten el valor diferencial.

### Dirección de colaboración (objetivo; arquitectura por decidir)

Lintea aspira a permitir que varias personas o terminales trabajen sobre un proyecto y vean cambios originados en otros lugares. La colaboración forma parte del núcleo definitivo junto con las relaciones, la persistencia y la recuperación. El modelo debe conservar identificadores, procedencia y anclajes, y permitir examinar qué cambió, quién lo cambió y cómo llegó al proyecto.

La estrategia de sincronización sigue abierta: servidor intermedio, conexión P2P o una combinación. Antes de elegir, se compararán fiabilidad, privacidad, funcionamiento sin conexión, facilidad de recuperación, complejidad de conflictos, coste de operación y accesibilidad. Las salvaguardas y versiones locales pueden informar la forma de representar cambios, pero no se da por decidido que un historial de instantáneas sea suficiente como protocolo de colaboración. La prueba de concepto deberá mostrar cambios entre terminales y ensayar cambios simultáneos antes de comprometer el formato de exportación.

Los hitos se deciden por pruebas verificables, no solo por calendario. Las estimaciones son orientativas: una versión útil puede requerir muchos meses y una madura, años, especialmente aprendiendo a la vez.


## 10. Prueba inicial de aceptación

Crear un proyecto de prueba, un documento con dos fragmentos, una ficha de personaje o concepto y una fuente. Vincular un fragmento con ambos.

Editar el fragmento, incluso antes y dentro del anclaje. La relación debe conservarse o marcarse para revisión; nunca recolocarse silenciosamente cuando no haya confianza.

Guardar, cerrar y reabrir. Verificar que documentos, identificadores y relaciones persisten. Exportar y comprobar que se pueden reconstruir los vínculos.

Éxito: no perder silenciosamente texto ni relaciones, no cambiar originales automáticamente, mostrar errores comprensibles y permitir recuperación.


## 11. Calidad y forma de trabajo

Cada función debe tener definición de terminado y pruebas. Los cambios de datos requieren pruebas de casos normales, errores, restauración y migración.

El código generado con ayuda de IA se revisa, prueba y entiende antes de incorporarlo. No aceptar reescrituras arquitectónicas grandes sin razón documentada.

Mantener decisiones técnicas en docs/, tareas pequeñas en un registro y código bajo control de versiones Git. Los chats no deben ser el único lugar donde existan especificaciones.

Ritmo sugerido para sesiones de 3–4 horas: planificar; implementar una tarea acotada; probar y estudiar el código; registrar cambios, comprobaciones y siguiente paso.

Priorizar fiabilidad, relaciones duraderas, recuperación, exportación y privacidad antes que muchas funciones llamativas.


## 12. Evolución y decisiones pendientes

Este documento es una guía viva. Las decisiones pueden cambiar cuando una prueba muestre una opción mejor, documentando motivo, coste de migración y efecto sobre los principios.

Pendiente: nombre comercial definitivo y comprobación legal; licencia del repositorio; esquema detallado y cobertura de relaciones; integración SQLite/Tauri; modelo de colaboración, identidad y permisos; sincronización P2P, mediante servidor o híbrida; funcionamiento sin conexión y resolución de conflictos; historial de cambios compartido; formato exhaustivo de proyecto y estrategia de respaldo; eliminación segura de proyectos; formatos de manuscrito; extensiones; proveedores de IA y política de privacidad específica.

### Observaciones de interfaz para una próxima iteración

- El panel contextual debe adaptar automáticamente qué secciones expande según la vista y el elemento activo: composición al trabajar con capítulos o fragmentos; fichas al consultar fichas; fuentes al consultar referencias. Los títulos permitirán expandir o contraer manualmente cualquier sección, sin impedir explorar el resto del contexto.
- La navegación de composición debe ser simétrica y estar cerca del contenido: desde un capítulo se accede a sus fragmentos y, desde un fragmento, a los capítulos donde está incluido. Conviene mostrar los capítulos vinculados en un bloque inferior del fragmento, además de la sección de composición del panel contextual.
- El acceso al panel contextual debe permanecer localizable al desplazarse por la interfaz. Revisar el diseño adaptable a distintos tamaños de ventana para evitar que el control desaparezca fuera de la zona visible.
- Mantener la edición del manuscrito ligera y centrada en escribir: títulos y subtítulos, listas numeradas o con letras, negrita, cursiva e inserción de imágenes o tablas como herramientas básicas. La apariencia de la interfaz y la del texto podrán configurarse por separado mediante skins; no convertir la personalización en una larga lista de controles individuales.

Estas notas expresan una dirección de diseño y deberán concretarse al abordar la siguiente iteración de interfaz, comprobando su comportamiento con el uso real.

### Requisitos para la evolución del historial de versiones

- El historial debe evitar registrar estados de contenido idénticos. La dirección deseada es guardar los cambios entre estados, al estilo de un historial de commits, en lugar de acumular copias completas redundantes. La implementación actual conserva estados únicos como instantáneas; el almacenamiento real por deltas queda pendiente y debe mantener la reconstrucción fiable de cualquier versión.
- Permitir comparar dos estados lado a lado y recuperar de forma selectiva una idea o pasaje antiguo sin reemplazar el documento entero.
- Permitir eliminar un punto de memoria con confirmación y una advertencia clara sobre lo que se borrará. Si el almacenamiento por deltas hace que otros estados dependan de ese punto, conservar la integridad del historial al eliminarlo y explicar las consecuencias antes de confirmar.

### Granularidad de etiquetas y relaciones

Una etiqueta aplicada a un capítulo completo puede ser demasiado amplia en manuscritos largos. Las relaciones deben poder localizar pasajes concretos y explicar su sentido con una cita contextual y una nota opcional del autor. Las etiquetas clasifican temas transversales; no sustituyen relaciones tipadas ni notas explicativas. La localización debe sobrevivir a ediciones mediante fragmentos con identidad propia o anclajes recuperables, no posiciones de caracteres rígidas.

Antes de añadir una función, preguntar: ¿ayuda a escribir, recordar, relacionar, comprobar o exportar? ¿Puede funcionar localmente? ¿Respeta el control del autor? ¿Se puede probar? ¿Añade dependencia o coste? ¿Conviene integrar una herramienta existente?

Toda ampliación debe mantener una vía de salida: exportación completa, identificadores documentados, versiones recuperables y posibilidad de trabajar sin servicios externos.


## 13. Glosario

Anclaje: referencia a una parte de un documento que intenta mantenerse válida cuando cambia el texto.

Entidad: elemento descrito por el usuario, como personaje, lugar, concepto, persona real, acontecimiento o institución.

Fragmento: unidad de texto que puede recibir relaciones y anotaciones propias.

Local-first: almacenamiento y funciones esenciales en el dispositivo del usuario; la nube no es requisito.

Monolito modular: una aplicación organizada en módulos con límites claros, sin dividirla prematuramente en servicios.

Proyecto completo: documentos, metadatos, relaciones, fuentes, anotaciones, recursos y versiones; más que un manuscrito.
