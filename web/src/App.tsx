
import { useEffect, useState } from "react";
import type { DocumentRecord, Id } from "../../src/core/model.js";
import { MemoryProjectStorage } from "../../src/core/memory-storage.js";
import { SqliteProjectStorage } from "../../src/adapters/sqlite-project-storage.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import type { ProjectStorage } from "../../src/core/storage.js";

type EditorDocument = DocumentRecord & {
  category: string;
};

let workspace: WorkspaceService | undefined;

async function getWorkspace(): Promise<WorkspaceService> {
  if (!workspace) {
    workspace = new WorkspaceService(await createStorage());
  }

  return workspace;
}

async function createStorage(): Promise<ProjectStorage> {
   console.log("[Lintea] Comprobando el entorno");
  if ("__TAURI_INTERNALS__" in window) {
    return SqliteProjectStorage.create();
  }
  console.log("[Lintea] Usando almacenamiento en memoria");
  return new MemoryProjectStorage();
}

let initialization: Promise<{
  projectId: Id;
  documents: EditorDocument[];
}> | undefined;

function initializeWorkspace() {
  if (!initialization) {
    initialization = (async () => {
      const workspace = await getWorkspace();
      let projects = await workspace.listProjects();

      if (projects.length === 0) {
        const project = await workspace.createProject({
          title: "Mi espacio de escritura"
        });

        const examples = [
          {
            title: "Una idea por desarrollar",
            text: "Toda historia comienza con una pregunta.\n\n¿Qué merece ser recordado? ¿Qué cambia cuando descubrimos una respuesta inesperada?",
            category: "Notas"
          },
          {
            title: "Investigación inicial",
            text: "Reunir fuentes, registrar las referencias y distinguir los hechos comprobados de las hipótesis.",
            category: "Investigación"
          },
          {
            title: "Fragmentos sueltos",
            text: "Imágenes, frases y observaciones que todavía no encuentran su lugar.",
            category: "Fragmentos"
          }
        ];

        for (const example of examples) {
          await workspace.createDocument({
            projectId: project.id,
            title: example.title,
            text: example.text
          });
        }

        projects = await workspace.listProjects();
      }

      const project = projects[0];

      if (!project) {
        throw new Error("No se pudo inicializar el espacio de trabajo.");
      }

      const documents = await workspace.listDocuments(project.id);

      return {
        projectId: project.id,
        documents: documents.map((document) => ({
          ...document,
          category:
            document.title === "Investigación inicial"
              ? "Investigación"
              : document.title === "Fragmentos sueltos"
                ? "Fragmentos"
                : "Notas"
        }))
      };
    })().catch((error: unknown) => {
  initialization = undefined;
  console.error("[Lintea] Error al inicializar:", error);
  throw error;
});
  }

  return initialization;
}

export default function App() {
  const [projectId, setProjectId] = useState<Id | null>(null);
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [activeId, setActiveId] = useState<Id | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDocument = documents.find((doc) => doc.id === activeId);

  useEffect(() => {
    let cancelled = false;

    initializeWorkspace()
      .then((result) => {
        if (cancelled) return;

        setProjectId(result.projectId);
        setDocuments(result.documents);
        setActiveId(result.documents[0]?.id ?? null);
        setError(null);
      })
      .catch((reason: unknown) => {
  if (cancelled) return;

  console.error("[Lintea] Error al cargar el espacio de trabajo:", reason);

  const detail =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);

  setError(`No se pudo cargar el espacio de trabajo. Detalle: ${detail}`);
})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateActiveDocument(
    field: "title" | "text",
    value: string
  ) {
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === activeId ? { ...doc, [field]: value } : doc
      )
    );
  }

  async function saveActiveDocument() {
    if (!activeDocument) return;
    const workspace = await getWorkspace();
    setSaving(true);
    setError(null);

    try {
      const updated = await workspace.updateDocument(activeDocument.id, {
        title: activeDocument.title,
        text: activeDocument.text
      });

      setDocuments((current) =>
        current.map((doc) =>
          doc.id === updated.id
            ? { ...doc, ...updated }
            : doc
        )
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el documento."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createDocument() {
    if (!projectId) return;
    const workspace = await getWorkspace();
    setError(null);

    try {
      const created = await workspace.createDocument({
        projectId,
        title: "Documento sin título",
        text: ""
      });

      const editorDocument: EditorDocument = {
        ...created,
        category: "Notas"
      };

      setDocuments((current) => [...current, editorDocument]);
      setActiveId(created.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo crear el documento."
      );
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <main className="workspace">
          <p>Cargando tu espacio de escritura…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>lintea</strong>
            <span>Tu espacio de trabajo</span>
          </div>
        </div>

        <div className="project-label">PROYECTO ACTUAL</div>
        <div className="project-button">
          <span className="project-dot" />
          Mi espacio de escritura
          <span className="chevron">⌄</span>
        </div>

        <div className="section-heading">
          <span>Biblioteca</span>
          <button
            className="icon-button"
            onClick={() => void createDocument()}
            aria-label="Crear documento"
            title="Crear documento"
          >
            +
          </button>
        </div>

        <nav className="document-list" aria-label="Documentos">
          {documents.map((doc) => (
            <button
              key={doc.id}
              className={`document-item ${doc.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(doc.id)}
            >
              <span className="document-icon">▤</span>
              <span className="document-info">
                <span className="document-title">{doc.title || "Sin título"}</span>
                <span className="document-category">{doc.category}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="local-indicator">
            <span />
            Espacio local
          </div>
          <span className="version-label">LINTEA · PROTOTIPO</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Mi espacio</span>
            <span className="breadcrumb-separator">/</span>
            <span>{activeDocument?.category ?? "Documento"}</span>
          </div>

          <div className="topbar-actions">
            <span className="save-status">
              ● {saving ? "Guardando…" : "Almacenamiento en memoria"}
            </span>
            <button
              className="context-toggle"
              onClick={() => setShowContext((visible) => !visible)}
            >
              {showContext ? "Ocultar contexto" : "Mostrar contexto"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}

        <div className={`editor-layout ${showContext ? "" : "context-hidden"}`}>
          <section className="editor">
            <div className="editor-meta">
              <span className="eyebrow">DOCUMENTO DE TRABAJO</span>
              <span className="meta-divider">·</span>
              <span>{activeDocument?.category ?? "Documento"}</span>
            </div>

            {activeDocument ? (
              <>
                <input
                  className="title-input"
                  aria-label="Título del documento"
                  value={activeDocument.title}
                  onChange={(event) =>
                    updateActiveDocument("title", event.target.value)
                  }
                  onBlur={() => void saveActiveDocument()}
                  placeholder="Título del documento"
                />

                <div className="editor-divider" />

                <textarea
                  className="document-editor"
                  aria-label="Contenido del documento"
                  value={activeDocument.text}
                  onChange={(event) =>
                    updateActiveDocument("text", event.target.value)
                  }
                  onBlur={() => void saveActiveDocument()}
                  placeholder="Empieza a escribir tus ideas..."
                  spellCheck
                />

                <div className="editor-footer">
                  <span>Los cambios se guardan al salir del campo.</span>
                  <span>{activeDocument.text.length} caracteres</span>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>Tu siguiente idea empieza aquí</h2>
                <p>Crea un documento para comenzar a escribir.</p>
                <button
                  className="primary-button"
                  onClick={() => void createDocument()}
                >
                  Crear documento
                </button>
              </div>
            )}
          </section>

          {showContext && (
            <aside className="context-panel">
              <div className="context-header">
                <span className="eyebrow">PANEL CONTEXTUAL</span>
                <span className="context-menu">···</span>
              </div>

              <section className="context-section">
                <div className="context-section-title">
                  <span className="context-symbol">◇</span>
                  <h2>Ideas relacionadas</h2>
                </div>
                <p className="muted-copy">
                  Las conexiones que establezcas entre tus notas aparecerán aquí.
                </p>
                <button className="outline-button" disabled>
                  + Añadir relación
                </button>
              </section>

              <section className="context-section">
                <div className="context-section-title">
                  <span className="context-symbol">▤</span>
                  <h2>Fuentes</h2>
                </div>
                <p className="muted-copy">
                  Guarda referencias y fuentes para documentar tus ideas.
                </p>
                <button className="outline-button" disabled>
                  + Añadir fuente
                </button>
              </section>

              <section className="context-section">
                <div className="context-section-title">
                  <span className="context-symbol">◷</span>
                  <h2>Actividad</h2>
                </div>
                <p className="muted-copy">
                  El historial de versiones estará disponible en una próxima etapa.
                </p>
              </section>

              <div className="context-note">
                <span className="note-icon">✳</span>
                <p>
                  <strong>Un espacio para pensar.</strong>
                  <br />
                  Lintea organiza tus ideas sin decidir por ti qué debes escribir.
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
