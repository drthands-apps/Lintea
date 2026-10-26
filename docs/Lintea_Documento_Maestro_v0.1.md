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


## 5. Capacidades previstas

Núcleo: proyectos, documentos, fragmentos identificables, notas, etiquetas, búsqueda, guardado fiable y recuperación.

Conocimiento relacionado: fichas de personajes, lugares, conceptos, acontecimientos, hechos, cronologías, fuentes, anotaciones, hipótesis, imágenes y vínculos tipados.

Panel contextual: relaciones del fragmento activo, fuentes citadas, eventos temporales, notas asociadas y acceso a fichas relevantes.

Biblioteca de referencia: materiales propios, referencias externas, metadatos bibliográficos, enlaces, citas y notas de lectura. Al principio puede guardar referencias y archivos locales.

Tablero de conexiones: tarjetas, relaciones visuales, filtros por tipo, varios tableros por proyecto y navegación hacia los elementos originales.

Cronología: eventos ordenados por fecha o intervalo, con vínculos a documentos, personajes, fuentes y acontecimientos. Debe admitir fechas aproximadas o desconocidas.

Versiones y comparación: historial recuperable, comparación de cambios y restauración explícita.

Búsqueda: texto literal, metadatos, tipos de elemento y relaciones; más adelante, búsqueda semántica, sin sustituir la búsqueda exacta.

Revisión de coherencia: detección asistida de posibles contradicciones, nombres o fechas inconsistentes y referencias sin fuente. Mostrar evidencia y dejar la decisión al usuario.

IA opcional: corrección, opinión estilística, comparación de versiones, revisión de coherencia y apoyo bibliográfico. Explicar el contexto utilizado y los límites; nunca será obligatoria.

Herramientas externas: diccionarios, tesauros, correctores, catálogos bibliográficos, repositorios, visualizadores PDF e imágenes. Usar API cuando convenga; de lo contrario, ofrecer enlaces o apertura externa.

Importación y exportación: formatos comunes para manuscritos (por ejemplo, Markdown, HTML, DOCX y ODT cuando sea viable) y exportación completa del proyecto, con relaciones, notas y recursos. Un manuscrito no equivale al proyecto completo.


## 6. Modelo conceptual de datos

Entidades iniciales: Project, Document, Fragment, Entity, Source, Relation, Annotation, Event y Version. Se pueden ajustar, pero los identificadores estables son fundamentales.

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

Fase 0 — Especificación y prueba de concepto: documentar arquitectura y modelo; demostrar identificadores, relaciones y recuperación de anclajes tras editar.

Fase 1 — Núcleo utilizable: proyectos, documentos, fragmentos, notas, etiquetas, guardado local, búsqueda básica y exportación sencilla.

Fase 2 — Relaciones y contexto: fichas de entidades, fuentes, panel contextual, vínculos desde fragmentos y navegación entre elementos.

Fase 3 — Cronología, tablero y versiones: vistas complementarias, comparación y restauración; pruebas de persistencia y migraciones.

Fase 4 — Biblioteca e importación/exportación: metadatos, recursos adjuntos, formato de proyecto documentado y exportación de manuscrito.

Fase 5 — Revisión y extensibilidad: reglas de coherencia configurables, integraciones útiles y acciones de IA opcionales con consentimiento.

Fase 6 — Calidad y publicación: pruebas de regresión, accesibilidad, instaladores, copias de seguridad, documentación, guía de contribución, revisión de licencias y publicación.

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

Pendiente: nombre comercial definitivo y comprobación legal; licencia del repositorio; esquema detallado; formato de proyecto; integración SQLite/Tauri; formatos prioritarios; estrategia de respaldo; extensiones; proveedores de IA y política de privacidad específica.

Antes de añadir una función, preguntar: ¿ayuda a escribir, recordar, relacionar, comprobar o exportar? ¿Puede funcionar localmente? ¿Respeta el control del autor? ¿Se puede probar? ¿Añade dependencia o coste? ¿Conviene integrar una herramienta existente?

Toda ampliación debe mantener una vía de salida: exportación completa, identificadores documentados, versiones recuperables y posibilidad de trabajar sin servicios externos.


## 13. Glosario

Anclaje: referencia a una parte de un documento que intenta mantenerse válida cuando cambia el texto.

Entidad: elemento descrito por el usuario, como personaje, lugar, concepto, persona real, acontecimiento o institución.

Fragmento: unidad de texto que puede recibir relaciones y anotaciones propias.

Local-first: almacenamiento y funciones esenciales en el dispositivo del usuario; la nube no es requisito.

Monolito modular: una aplicación organizada en módulos con límites claros, sin dividirla prematuramente en servicios.

Proyecto completo: documentos, metadatos, relaciones, fuentes, anotaciones, recursos y versiones; más que un manuscrito.
