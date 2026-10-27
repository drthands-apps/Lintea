
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DocumentRecord,
  DocumentKind,
  CompositionEntry,
  AuthorNote,
  AuthorNoteColor,
  Id,
  KnowledgeEntity,
  Project,
  ProjectContext,
  Relation,
  SourceRecord,
  Tag,
  TagAssignment,
  TagTargetType
} from "../../src/core/model.js";
import { createId } from "../../src/core/model.js";
import { MemoryProjectStorage } from "../../src/core/memory-storage.js";
import { SqliteProjectStorage } from "../../src/adapters/sqlite-project-storage.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import type { ProjectStorage } from "../../src/core/storage.js";
import { createFragmentAnchor, resolveFragmentAnchor } from "../../src/core/anchors.js";
import type { DocumentVersion } from "../../src/core/versions.js";
import { buildProjectSearchIndex, searchIndexedProject } from "../../src/core/search.js";
import type { SearchResult } from "../../src/core/search.js";

type EditorDocument = DocumentRecord & {
  category: string;
};

function TagSelector({ tags, selectedIds, onToggle, onManage }: {
  tags: Tag[]; selectedIds: Id[]; onToggle: (tagId: Id) => void; onManage: () => void;
}) {
  return (
    <div className="tag-selector">
      <span>Etiquetas</span>
      {tags.length ? <div className="tag-chip-list">
        {tags.map((tag) => (
          <button key={tag.id} className={`tag-chip ${selectedIds.includes(tag.id) ? "selected" : ""}`} aria-pressed={selectedIds.includes(tag.id)} onClick={() => onToggle(tag.id)}>
            {selectedIds.includes(tag.id) ? "✓ " : "＋ "}{tag.name}
          </button>
        ))}
      </div> : <small>Aún no hay etiquetas en este proyecto.</small>}
      <button className="tag-manage-link" onClick={onManage}>{tags.length ? "Gestionar etiquetas" : "Crear primera etiqueta"}</button>
    </div>
  );
}

function searchResultType(type: SearchResult["type"]): string {
  return type === "document" ? "Documento" : type === "entity" ? "Ficha" : type === "source" ? "Fuente" : "Nota";
}

function entityKindLabel(kind: KnowledgeEntity["kind"]): string {
  const labels: Record<KnowledgeEntity["kind"], string> = {
    character: "Personaje", place: "Lugar", event: "Acontecimiento", story: "Historia",
    concept: "Concepto", person: "Persona", organization: "Organización", other: "Otro"
  };
  return labels[kind];
}

async function loadProjectComposition(service: WorkspaceService, documents: DocumentRecord[]): Promise<CompositionEntry[]> {
  const chapters = documents.filter((document) => document.kind === "chapter");
  const entries = await Promise.all(chapters.map((chapter) => service.listCompositionEntries(chapter.id)));
  return entries.flat();
}

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
  projects: Project[];
  project: Project;
  documents: EditorDocument[];
  entities: KnowledgeEntity[];
  sources: SourceRecord[];
  relations: Relation[];
  composition: CompositionEntry[];
  notes: AuthorNote[];
  tags: Tag[];
  tagAssignments: TagAssignment[];
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

      const rememberedProjectId = window.localStorage.getItem("lintea.activeProjectId");
      const project =
        projects.find((item) => item.id === rememberedProjectId) ?? projects[0];

      if (!project) {
        throw new Error("No se pudo inicializar el espacio de trabajo.");
      }

      const documents = await workspace.listDocuments(project.id);
      const [entities, sources, relations, notes, tags, tagAssignments] = await Promise.all([
        workspace.listKnowledgeEntities(project.id),
        workspace.listSources(project.id),
        workspace.listRelations(project.id),
        workspace.listAuthorNotes(project.id),
        workspace.listTags(project.id),
        workspace.listTagAssignments(project.id)
      ]);
      const composition = await loadProjectComposition(workspace, documents);

      return {
        projects,
        project,
        documents: documents.map((document) => ({
          ...document,
          category:
            document.kind === "chapter"
              ? "Capítulo"
              : document.kind === "fragment"
                ? "Fragmento"
                : document.title === "Investigación inicial"
              ? "Investigación"
              : document.title === "Fragmentos sueltos"
                ? "Fragmentos"
                : "Notas"
        })),
        entities,
        sources,
        relations,
        composition,
        notes,
        tags,
        tagAssignments
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [contextDraft, setContextDraft] =
    useState<ProjectContext | null>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [projectId, setProjectId] = useState<Id | null>(null);
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [entities, setEntities] = useState<KnowledgeEntity[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [projectComposition, setProjectComposition] = useState<CompositionEntry[]>([]);
  const [activeView, setActiveView] = useState<"writing" | "entities" | "sources" | "notes" | "tags">("writing");
  const [authorNotes, setAuthorNotes] = useState<AuthorNote[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagNameDrafts, setTagNameDrafts] = useState<Record<Id, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<Id | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteColor, setNewNoteColor] = useState<AuthorNoteColor>("sand");
  const [newNoteTarget, setNewNoteTarget] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<Id | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<Id | null>(null);
  const [activeId, setActiveId] = useState<Id | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [contextSectionsOpen, setContextSectionsOpen] = useState({
    project: false, tags: false, entities: false, sources: false, composition: false, activity: false
  });
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newEntityTitle, setNewEntityTitle] = useState("");
  const [newEntityKind, setNewEntityKind] = useState<KnowledgeEntity["kind"]>("character");
  const [entityToLink, setEntityToLink] = useState("");
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceAuthor, setNewSourceAuthor] = useState("");
  const [newSourceCitation, setNewSourceCitation] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceDoi, setNewSourceDoi] = useState("");
  const [sourceToLink, setSourceToLink] = useState("");
  const [fragmentToInclude, setFragmentToInclude] = useState("");
  const [chapterToIncludeIn, setChapterToIncludeIn] = useState("");
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(null);
  const [pendingTextAnchor, setPendingTextAnchor] = useState<{ documentId: Id; anchor: NonNullable<Relation["anchor"]> } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [compositionEntries, setCompositionEntries] = useState<CompositionEntry[]>([]);
  const [fragmentChapterIds, setFragmentChapterIds] = useState<Id[]>([]);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
  const [versionLabel, setVersionLabel] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [showNewDocumentMenu, setShowNewDocumentMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDocument = documents.find((doc) => doc.id === activeId);
  const searchIndex = useMemo(() => buildProjectSearchIndex({
    documents, entities, sources, notes: authorNotes, tags, assignments: tagAssignments
  }), [documents, entities, sources, authorNotes, tags, tagAssignments]);
  const searchResults = useMemo(() => searchIndexedProject(searchIndex, searchQuery), [searchIndex, searchQuery]);

  function assignedTagIds(targetType: TagTargetType, targetId: Id): Id[] {
    return tagAssignments.filter((assignment) => assignment.targetType === targetType && assignment.targetId === targetId).map((assignment) => assignment.tagId);
  }

  async function toggleTagAssignment(targetType: TagTargetType, targetId: Id, tagId: Id) {
    if (!projectId) return;
    const assignment: TagAssignment = { projectId, tagId, targetType, targetId };
    const exists = tagAssignments.some((item) => item.tagId === tagId && item.targetType === targetType && item.targetId === targetId);
    try {
      const service = await getWorkspace();
      await service.setTagAssignment(assignment, !exists);
      setTagAssignments((current) => exists
        ? current.filter((item) => !(item.tagId === tagId && item.targetType === targetType && item.targetId === targetId))
        : [...current, assignment]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la etiqueta.");
    }
  }

  async function createProjectTag() {
    if (!projectId || !newTagName.trim()) return;
    try {
      const service = await getWorkspace();
      const tag = await service.createTag(projectId, newTagName);
      setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setNewTagName("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la etiqueta.");
    }
  }

  async function saveProjectTag(tag: Tag) {
    try {
      const service = await getWorkspace();
      const updated = await service.updateTag(tag.projectId, tag.id, tagNameDrafts[tag.id] ?? tag.name);
      setTags((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name, "es")));
      setTagNameDrafts((current) => { const next = { ...current }; delete next[tag.id]; return next; });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo renombrar la etiqueta.");
    }
  }

  async function deleteProjectTag(tag: Tag) {
    const uses = tagAssignments.filter((assignment) => assignment.tagId === tag.id).length;
    if (!window.confirm(`¿Eliminar la etiqueta «${tag.name}»? Se quitará de ${uses} elemento${uses === 1 ? "" : "s"}; los elementos no se eliminarán.`)) return;
    try {
      const service = await getWorkspace();
      await service.deleteTag(tag.projectId, tag.id);
      setTags((current) => current.filter((item) => item.id !== tag.id));
      setTagAssignments((current) => current.filter((item) => item.tagId !== tag.id));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la etiqueta.");
    }
  }

  function openSearchResult(result: SearchResult) {
    setShowSearchResults(false);
    setSearchQuery("");
    if (result.type === "document") {
      setActiveId(result.id);
      setActiveView("writing");
      setTextSelection(null);
    } else if (result.type === "entity") {
      setSelectedEntityId(result.id);
      setActiveView("entities");
      setShowContext(false);
      window.setTimeout(() => document.getElementById(`catalog-entity-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } else if (result.type === "source") {
      setSelectedSourceId(result.id);
      setActiveView("sources");
      setShowContext(false);
      window.setTimeout(() => document.getElementById(`catalog-source-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } else {
      setSelectedNoteId(result.id);
      setActiveView("notes");
      setShowContext(false);
      window.setTimeout(() => document.getElementById(`catalog-note-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }

  useEffect(() => {
    const linkedToActive = (type: "entity" | "source") => Boolean(activeDocument && relations.some((relation) =>
      (relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === type) ||
      (relation.toType === "document" && relation.toId === activeDocument.id && relation.fromType === type)
    ));
    setContextSectionsOpen({
      project: false,
      tags: activeView === "writing" && Boolean(activeDocument && assignedTagIds("document", activeDocument.id).length),
      entities: activeView === "entities" || (activeView === "writing" && linkedToActive("entity")),
      sources: activeView === "sources" || (activeView === "writing" && linkedToActive("source")),
      composition: activeView === "writing" && (activeDocument?.kind === "chapter" || activeDocument?.kind === "fragment"),
      activity: false
    });
  }, [activeId, activeView, relations, tagAssignments]);

  useEffect(() => {
    let cancelled = false;
    if (!activeDocument) {
      setCompositionEntries([]);
      setFragmentChapterIds([]);
      return;
    }
    if (activeDocument.kind === "chapter") {
      setFragmentChapterIds([]);
      void getWorkspace().then((service) => service.listCompositionEntries(activeDocument.id))
        .then((entries) => { if (!cancelled) setCompositionEntries(entries); })
        .catch((reason: unknown) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la composición.");
        });
    } else if (activeDocument.kind === "fragment") {
      setCompositionEntries([]);
      const chapters = documents.filter((item) => item.kind === "chapter");
      void getWorkspace().then(async (service) => {
        const entriesByChapter = await Promise.all(chapters.map((chapter) => service.listCompositionEntries(chapter.id)));
        return chapters.filter((_, index) => entriesByChapter[index]?.some((entry) => entry.fragmentId === activeDocument.id)).map((chapter) => chapter.id);
      }).then((chapterIds) => { if (!cancelled) setFragmentChapterIds(chapterIds); })
        .catch((reason: unknown) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudieron consultar los capítulos vinculados.");
        });
    } else {
      setCompositionEntries([]);
      setFragmentChapterIds([]);
    }
    return () => { cancelled = true; };
  }, [activeId, activeDocument?.kind]);

  useEffect(() => {
    let cancelled = false;
    setDocumentVersions([]);
    setVersionLabel("");
    setVersionNote("");
    if (!activeDocument || activeView !== "writing") return;
    void getWorkspace().then((service) => service.listDocumentVersions(activeDocument.id))
      .then((versions) => { if (!cancelled) setDocumentVersions(versions); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial.");
      });
    return () => { cancelled = true; };
  }, [activeId, activeView]);

  useEffect(() => {
    if (!pendingTextAnchor || activeId !== pendingTextAnchor.documentId || activeView !== "writing") return;
    const document = documents.find((item) => item.id === pendingTextAnchor.documentId);
    if (!document) return;
    const resolution = resolveFragmentAnchor(pendingTextAnchor.anchor, document.text);
    if (resolution.status === "resolved") {
      const range = { start: resolution.start, end: resolution.end };
      setTextSelection(range);
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.setSelectionRange(range.start, range.end);
      });
    } else {
      setTextSelection(null);
      setError(`No pude localizar con seguridad el pasaje vinculado: «${pendingTextAnchor.anchor.quote}». El documento está abierto para que lo revises.`);
    }
    setPendingTextAnchor(null);
  }, [pendingTextAnchor, activeId, activeView, documents]);

  useEffect(() => {
    let cancelled = false;

    initializeWorkspace()
      .then((result) => {
        if (cancelled) return;

        setProject(result.project);
        setProjects(result.projects);
        window.localStorage.setItem("lintea.activeProjectId", result.project.id);
        setProjectTitleDraft(result.project.title);
        setProjectId(result.project.id);
        setContextDraft({
          kind: result.project.context?.kind ?? "other",
          primaryLanguage: result.project.context?.primaryLanguage ?? "und",
          additionalLanguages: [
            ...(result.project.context?.additionalLanguages ?? [])
          ],
          editorialStyle: result.project.context?.editorialStyle ?? "classic"
        });
        setDocuments(result.documents);
        setEntities(result.entities);
        setSources(result.sources);
        setRelations(result.relations);
        setProjectComposition(result.composition);
        setAuthorNotes(result.notes);
        setTags(result.tags);
        setTagAssignments(result.tagAssignments);
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

  async function saveProjectContext() {
    if (!project || !contextDraft) return;

    setSavingContext(true);
    setError(null);

    try {
      const workspace = await getWorkspace();
      const updated = await workspace.updateProject(project.id, {
        title: projectTitleDraft,
        context: {
          ...contextDraft,
          additionalLanguages: contextDraft.additionalLanguages
            .map((language) => language.trim())
            .filter(Boolean)
        }
      });

      setProject(updated);
      setProjects((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      );
      setProjectTitleDraft(updated.title);
      setContextDraft({
        ...updated.context!,
        additionalLanguages: [...updated.context!.additionalLanguages]
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el contexto del proyecto."
      );
    } finally {
      setSavingContext(false);
    }
  }

  async function selectProject(nextProject: Project) {
    if (nextProject.id === project?.id) {
      setShowProjectMenu(false);
      return;
    }

    try {
      const workspace = await getWorkspace();
      const [projectDocuments, projectEntities, projectSources, projectRelations, projectNotes, projectTags, projectTagAssignments] = await Promise.all([
        workspace.listDocuments(nextProject.id),
        workspace.listKnowledgeEntities(nextProject.id),
        workspace.listSources(nextProject.id),
        workspace.listRelations(nextProject.id),
        workspace.listAuthorNotes(nextProject.id),
        workspace.listTags(nextProject.id),
        workspace.listTagAssignments(nextProject.id)
      ]);
      const composition = await loadProjectComposition(workspace, projectDocuments);
      setProject(nextProject);
      setProjectId(nextProject.id);
      window.localStorage.setItem("lintea.activeProjectId", nextProject.id);
      setProjectTitleDraft(nextProject.title);
      setContextDraft({
        kind: nextProject.context?.kind ?? "other",
        primaryLanguage: nextProject.context?.primaryLanguage ?? "und",
        additionalLanguages: [...(nextProject.context?.additionalLanguages ?? [])],
        editorialStyle: nextProject.context?.editorialStyle ?? "classic"
      });
      setDocuments(projectDocuments.map((document) => ({
        ...document,
        category: document.kind === "chapter" ? "Capítulo" : document.kind === "fragment" ? "Fragmento" : "Notas"
      })));
      setEntities(projectEntities);
      setSources(projectSources);
      setRelations(projectRelations);
      setProjectComposition(composition);
      setAuthorNotes(projectNotes);
      setTags(projectTags);
      setTagAssignments(projectTagAssignments);
      setActiveView("writing");
      setActiveId(projectDocuments[0]?.id ?? null);
      setSelectedEntityId(null);
      setSelectedSourceId(null);
      setSelectedNoteId(null);
      setSearchQuery("");
      setShowSearchResults(false);
      setTagNameDrafts({});
      setSelectedEntityId(null);
      setSelectedSourceId(null);
      setSelectedNoteId(null);
      setSearchQuery("");
      setShowSearchResults(false);
      setTagNameDrafts({});
      setTextSelection(null);
      setShowProjectMenu(false);
      setShowContext(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir el proyecto.");
    }
  }

  async function createProject() {
    const title = newProjectTitle.trim();
    if (!title) return;

    try {
      const workspace = await getWorkspace();
      const created = await workspace.createProject({ title });
      setProjects((current) => [...current, created]);
      setProject(created);
      setProjectId(created.id);
      window.localStorage.setItem("lintea.activeProjectId", created.id);
      setProjectTitleDraft(created.title);
      setContextDraft({
        kind: created.context?.kind ?? "other",
        primaryLanguage: created.context?.primaryLanguage ?? "und",
        additionalLanguages: [...(created.context?.additionalLanguages ?? [])],
        editorialStyle: created.context?.editorialStyle ?? "classic"
      });
      setDocuments([]);
      setEntities([]);
      setSources([]);
      setRelations([]);
      setProjectComposition([]);
      setAuthorNotes([]);
      setTags([]);
      setTagAssignments([]);
      setActiveView("writing");
      setActiveId(null);
      setSelectedEntityId(null);
      setSelectedSourceId(null);
      setSelectedNoteId(null);
      setSearchQuery("");
      setShowSearchResults(false);
      setTagNameDrafts({});
      setSelectedEntityId(null);
      setSelectedSourceId(null);
      setSelectedNoteId(null);
      setSearchQuery("");
      setShowSearchResults(false);
      setTagNameDrafts({});
      setNewProjectTitle("");
      setShowProjectMenu(false);
      setShowContext(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el proyecto.");
    }
  }

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

  function selectedDocumentAnchor(document: EditorDocument | undefined = activeDocument): Relation["anchor"] {
    if (!document || !textSelection || textSelection.end > document.text.length || !document.text.slice(textSelection.start, textSelection.end).trim()) return undefined;
    const anchor = createFragmentAnchor(document.id, createId(), document.text, textSelection.start, textSelection.end);
    return { documentId: anchor.documentId, quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix };
  }

  function openDocumentAtAnchor(documentId: Id, anchor?: Relation["anchor"]) {
    const targetDocumentId = anchor?.documentId ?? documentId;
    setPendingTextAnchor(anchor ? { documentId: targetDocumentId, anchor } : null);
    setActiveId(targetDocumentId);
    setActiveView("writing");
    setTextSelection(null);
    setShowContext(false);
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

  async function saveVersion() {
    if (!activeDocument) return;
    setSaving(true);
    try {
      const service = await getWorkspace();
      const persisted = await service.updateDocument(activeDocument.id, {
        title: activeDocument.title, text: activeDocument.text
      });
      setDocuments((current) => current.map((item) => item.id === persisted.id ? { ...item, ...persisted } : item));
      await service.saveDocumentVersion(activeDocument.id, { label: versionLabel, note: versionNote });
      setDocumentVersions(await service.listDocumentVersions(activeDocument.id));
      setVersionLabel("");
      setVersionNote("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la versión.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(version: DocumentVersion) {
    if (!activeDocument) return;
    if (!window.confirm(`¿Recuperar «${version.label || version.title}»? El estado actual se conservará antes en el historial.`)) return;
    setSaving(true);
    try {
      const service = await getWorkspace();
      await service.updateDocument(activeDocument.id, {
        title: activeDocument.title, text: activeDocument.text
      });
      const restored = await service.restoreDocumentVersion(activeDocument.id, version.id);
      setDocuments((current) => current.map((item) => item.id === restored.id ? { ...item, ...restored } : item));
      setDocumentVersions(await service.listDocumentVersions(activeDocument.id));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo recuperar la versión.");
    } finally {
      setSaving(false);
    }
  }

  async function createDocument(kind: DocumentKind = "note") {
    if (!projectId) return;
    const workspace = await getWorkspace();
    setError(null);

    try {
      const created = await workspace.createDocument({
        projectId,
        title: kind === "chapter" ? "Capítulo sin título" : kind === "fragment" ? "Fragmento sin título" : "Documento sin título",
        text: "",
        kind,
        order: documents.filter((document) => document.kind === kind).length
      });

      const editorDocument: EditorDocument = {
        ...created,
        category: kind === "chapter" ? "Capítulo" : kind === "fragment" ? "Fragmento" : "Notas"
      };

      setDocuments((current) => [...current, editorDocument]);
      setActiveId(created.id);
      setTextSelection(null);
      setActiveView("writing");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo crear el documento."
      );
    }
  }

  async function createEntity() {
    if (!projectId || !newEntityTitle.trim()) return;
    try {
      const service = await getWorkspace();
      const entity = await service.createKnowledgeEntity({
        projectId, kind: newEntityKind, title: newEntityTitle
      });
      setEntities((current) => [...current, entity]);
      setNewEntityTitle("");
      if (activeDocument && activeView === "writing") {
        const anchor = selectedDocumentAnchor(activeDocument);
        const relation = await service.createRelation({
          projectId, fromId: activeDocument.id, fromType: "document",
          toId: entity.id, toType: "entity", kind: "mentions", anchor
        });
        setRelations((current) => [...current, relation]);
      }
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la ficha.");
    }
  }

  async function createSource() {
    if (!projectId || !newSourceTitle.trim()) return;
    try {
      const service = await getWorkspace();
      const source = await service.createSource({
        projectId, title: newSourceTitle, author: newSourceAuthor,
        citation: newSourceCitation, url: newSourceUrl, doi: newSourceDoi
      });
      setSources((current) => [...current, source]);
      setNewSourceTitle("");
      setNewSourceAuthor("");
      setNewSourceCitation("");
      setNewSourceUrl("");
      setNewSourceDoi("");
      if (activeDocument && activeView === "writing") {
        const anchor = selectedDocumentAnchor(activeDocument);
        const relation = await service.createRelation({
          projectId, fromId: activeDocument.id, fromType: "document",
          toId: source.id, toType: "source", kind: "supported_by",
          anchor
        });
        setRelations((current) => [...current, relation]);
      }
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la referencia.");
    }
  }

  async function linkExistingItem(type: "entity" | "source", itemId: Id) {
    if (!activeDocument || !projectId || !itemId) return;
    const exists = relations.some((relation) =>
      relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === type && relation.toId === itemId
    );
    if (exists) return;
    try {
      const service = await getWorkspace();
      const anchor = selectedDocumentAnchor(activeDocument);
      const relation = await service.createRelation({
        projectId, fromId: activeDocument.id, fromType: "document",
        toId: itemId, toType: type,
        kind: type === "source" ? "supported_by" : "mentions",
        anchor
      });
      setRelations((current) => [...current, relation]);
      if (type === "entity") setEntityToLink("");
      else setSourceToLink("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el vínculo.");
    }
  }

  async function includeFragment() {
    if (!activeDocument) return;
    const chapterId = activeDocument.kind === "chapter" ? activeDocument.id : chapterToIncludeIn;
    const fragmentId = activeDocument.kind === "fragment" ? activeDocument.id : fragmentToInclude;
    if (!chapterId || !fragmentId) return;
    try {
      const service = await getWorkspace();
      await service.includeFragmentInChapter(chapterId, fragmentId);
      const newEntry = await service.listCompositionEntries(chapterId);
      setProjectComposition((current) => [
        ...current.filter((entry) => entry.chapterId !== chapterId),
        ...newEntry
      ]);
      if (chapterId === activeDocument.id) {
        setCompositionEntries(newEntry);
      } else {
        setFragmentChapterIds((current) => current.includes(chapterId) ? current : [...current, chapterId]);
      }
      setFragmentToInclude("");
      setChapterToIncludeIn("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo incorporar el fragmento.");
    }
  }

  async function removeRelation(relationId: Id) {
    if (!projectId) return;
    try {
      const service = await getWorkspace();
      await service.deleteRelation(projectId, relationId);
      setRelations((current) => current.filter((item) => item.id !== relationId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo retirar la relación.");
    }
  }

  async function saveRelationNote(relationId: Id, noteText: string) {
    if (!projectId) return;
    try {
      const service = await getWorkspace();
      const saved = await service.updateRelationNote(projectId, relationId, noteText);
      setRelations((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la explicación del vínculo.");
    }
  }

  function relationTargetTitle(relation: Relation) {
    const targetId = relation.fromId === activeDocument?.id ? relation.toId : relation.fromId;
    const targetType = relation.fromId === activeDocument?.id ? relation.toType : relation.fromType;
    if (targetType === "entity") return entities.find((item) => item.id === targetId)?.title ?? "Ficha";
    if (targetType === "source") return sources.find((item) => item.id === targetId)?.title ?? "Fuente";
    return documents.find((item) => item.id === targetId)?.title ?? "Documento";
  }

  function openRelationTarget(relation: Relation) {
    const isFromDocument = relation.fromId === activeDocument?.id;
    const targetId = isFromDocument ? relation.toId : relation.fromId;
    const targetType = isFromDocument ? relation.toType : relation.fromType;
    setTextSelection(null);
    if (targetType === "entity" || targetType === "event") {
      setSelectedEntityId(targetId);
      setActiveView("entities");
    } else if (targetType === "source") {
      setSelectedSourceId(targetId);
      setActiveView("sources");
    } else {
      setActiveId(targetId);
      setActiveView("writing");
    }
  }

  function updateEntityDraft(entityId: Id, update: (entity: KnowledgeEntity) => KnowledgeEntity) {
    setEntities((current) => current.map((entity) => entity.id === entityId ? update(entity) : entity));
  }

  async function saveEntity(entity: KnowledgeEntity) {
    try {
      const service = await getWorkspace();
      const saved = await service.updateKnowledgeEntity(entity);
      setEntities((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la ficha.");
    }
  }

  async function deleteEntity(entity: KnowledgeEntity) {
    if (!window.confirm(`¿Eliminar la ficha «${entity.title}»? Se quitarán sus vínculos y las notas asociadas se conservarán vinculadas al proyecto.`)) return;
    try {
      const service = await getWorkspace();
      await service.deleteKnowledgeEntity(entity.projectId, entity.id);
      setEntities((current) => current.filter((item) => item.id !== entity.id));
      setRelations((current) => current.filter((relation) =>
        !((relation.fromId === entity.id && (relation.fromType === "entity" || relation.fromType === "event")) ||
          (relation.toId === entity.id && (relation.toType === "entity" || relation.toType === "event")))
      ));
      setAuthorNotes((current) => current.map((note) => note.targetId === entity.id && (note.targetType === "entity" || note.targetType === "event")
        ? { ...note, targetType: undefined, targetId: undefined }
        : note));
      setSelectedEntityId((current) => current === entity.id ? null : current);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la ficha.");
    }
  }

  async function saveSource(source: SourceRecord) {
    try {
      const service = await getWorkspace();
      const saved = await service.updateSource(source);
      setSources((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la fuente.");
    }
  }

  async function deleteSource(source: SourceRecord) {
    if (!window.confirm(`¿Eliminar la fuente «${source.title}»? Se quitarán sus citas y vínculos; las notas asociadas se conservarán vinculadas al proyecto.`)) return;
    try {
      const service = await getWorkspace();
      await service.deleteSource(source.projectId, source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      setRelations((current) => current.filter((relation) =>
        !((relation.fromType === "source" && relation.fromId === source.id) ||
          (relation.toType === "source" && relation.toId === source.id))
      ));
      setAuthorNotes((current) => current.map((note) => note.targetType === "source" && note.targetId === source.id
        ? { ...note, targetType: undefined, targetId: undefined }
        : note));
      setSelectedSourceId((current) => current === source.id ? null : current);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la fuente.");
    }
  }

  async function moveCatalogItem(kind: "entity" | "source" | "note", itemId: Id, direction: -1 | 1) {
    const items = kind === "entity" ? [...entities] : kind === "source" ? [...sources] : [...authorNotes];
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = items.findIndex((item) => item.id === itemId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= items.length) return;
    [items[index], items[destination]] = [items[destination]!, items[index]!];
    const ordered = items.map((item, order) => ({ ...item, order }));
    try {
      const service = await getWorkspace();
      if (kind === "entity") {
        await Promise.all((ordered as KnowledgeEntity[]).map((item) => service.updateKnowledgeEntity(item)));
        setEntities(ordered as KnowledgeEntity[]);
      } else if (kind === "source") {
        await Promise.all((ordered as SourceRecord[]).map((item) => service.updateSource(item)));
        setSources(ordered as SourceRecord[]);
      } else {
        await Promise.all((ordered as AuthorNote[]).map((item) => service.updateAuthorNote(item)));
        setAuthorNotes(ordered as AuthorNote[]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el orden.");
    }
  }

  function entityUsage(entityId: Id) {
    const linked = relations.flatMap((relation) => {
      if (relation.fromType === "entity" && relation.fromId === entityId) {
        return [{ id: relation.toId, type: relation.toType, anchor: relation.anchor, note: relation.note }];
      }
      if (relation.toType === "entity" && relation.toId === entityId) {
        return [{ id: relation.fromId, type: relation.fromType, anchor: relation.anchor, note: relation.note }];
      }
      return [];
    }).filter((item) => item.type === "document" || item.type === "fragment");
    const usages = new Map<Id, { document: EditorDocument; relationship: string; anchor?: Relation["anchor"]; note?: string }>();
    for (const item of linked) {
      const linkedDocument = documents.find((document) => document.id === item.id);
      if (!linkedDocument) continue;
      usages.set(linkedDocument.id, { document: linkedDocument, relationship: "Vínculo directo", anchor: item.anchor, note: item.note });
      if (linkedDocument.kind === "fragment") {
        for (const entry of projectComposition.filter((entry) => entry.fragmentId === linkedDocument.id)) {
          const chapter = documents.find((document) => document.id === entry.chapterId);
          if (chapter && !usages.has(chapter.id)) {
            usages.set(chapter.id, { document: chapter, relationship: `A través de «${linkedDocument.title}»`, anchor: item.anchor, note: item.note });
          }
        }
      }
    }
    return [...usages.values()];
  }

  function sourceUsage(sourceId: Id) {
    const linkedIds = relations.flatMap((relation) => {
      if (relation.fromType === "source" && relation.fromId === sourceId) return [{ id: relation.toId, type: relation.toType, anchor: relation.anchor, note: relation.note }];
      if (relation.toType === "source" && relation.toId === sourceId) return [{ id: relation.fromId, type: relation.fromType, anchor: relation.anchor, note: relation.note }];
      return [];
    }).filter((item) => item.type === "document" || item.type === "fragment");
    const usages = new Map<Id, { document: EditorDocument; relationship: string; anchor?: Relation["anchor"]; note?: string }>();
    for (const item of linkedIds) {
      const document = documents.find((candidate) => candidate.id === item.id);
      if (!document) continue;
      usages.set(document.id, { document, relationship: "Vínculo directo", anchor: item.anchor, note: item.note });
      if (document.kind === "fragment") {
        for (const entry of projectComposition.filter((entry) => entry.fragmentId === document.id)) {
          const chapter = documents.find((candidate) => candidate.id === entry.chapterId);
          if (chapter && !usages.has(chapter.id)) usages.set(chapter.id, { document: chapter, relationship: `A través de «${document.title}»`, anchor: item.anchor, note: item.note });
        }
      }
    }
    return [...usages.values()];
  }

  async function createAuthorNote() {
    if (!projectId || !newNoteContent.trim()) return;
    const [targetType, targetId] = newNoteTarget ? newNoteTarget.split(":", 2) : [];
    try {
      const service = await getWorkspace();
      const note = await service.createAuthorNote({
        projectId, content: newNoteContent, color: newNoteColor,
        targetType: targetType as Relation["fromType"] | undefined,
        targetId
      });
      setAuthorNotes((current) => [note, ...current]);
      setNewNoteContent("");
      setNewNoteTarget("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la nota.");
    }
  }

  async function saveAuthorNote(note: AuthorNote) {
    try {
      const service = await getWorkspace();
      const saved = await service.updateAuthorNote(note);
      setAuthorNotes((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la nota.");
    }
  }

  async function deleteAuthorNote(noteId: Id) {
    if (!projectId) return;
    try {
      const service = await getWorkspace();
      await service.deleteAuthorNote(projectId, noteId);
      setAuthorNotes((current) => current.filter((item) => item.id !== noteId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la nota.");
    }
  }

  function authorNoteTarget(note: AuthorNote) {
    if (!note.targetType || !note.targetId) return "Proyecto";
    if (note.targetType === "entity" || note.targetType === "event") {
      return entities.find((entity) => entity.id === note.targetId)?.title ?? "Ficha";
    }
    if (note.targetType === "source") return sources.find((source) => source.id === note.targetId)?.title ?? "Fuente";
    return documents.find((document) => document.id === note.targetId)?.title ?? "Documento";
  }

  function openAuthorNoteTarget(note: AuthorNote) {
    if (!note.targetType || !note.targetId) return;
    if (note.targetType === "entity" || note.targetType === "event") {
      setSelectedEntityId(note.targetId);
      setActiveView("entities");
    } else if (note.targetType === "source") {
      setSelectedSourceId(note.targetId);
      setActiveView("sources");
    } else {
      setActiveId(note.targetId);
      setActiveView("writing");
    }
  }

  async function moveChapter(documentId: Id, direction: -1 | 1) {
    const chapters = documents.filter((item) => item.kind === "chapter")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = chapters.findIndex((item) => item.id === documentId);
    const neighbor = chapters[index + direction];
    const current = chapters[index];
    if (!current || !neighbor) return;
    const updatedCurrent = { ...current, order: neighbor.order ?? 0 };
    const updatedNeighbor = { ...neighbor, order: current.order ?? 0 };
    try {
      const service = await getWorkspace();
      await Promise.all([
        service.updateDocument(current.id, { order: updatedCurrent.order }),
        service.updateDocument(neighbor.id, { order: updatedNeighbor.order })
      ]);
      setDocuments((items) => items.map((item) =>
        item.id === current.id ? updatedCurrent : item.id === neighbor.id ? updatedNeighbor : item
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo reordenar el capítulo.");
    }
  }

  async function moveComposedFragment(entryId: Id, direction: -1 | 1) {
    if (!activeDocument) return;
    const ordered = [...compositionEntries].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((entry) => entry.id === entryId);
    const neighbor = ordered[index + direction];
    if (!ordered[index] || !neighbor) return;
    [ordered[index], ordered[index + direction]] = [ordered[index + direction]!, ordered[index]!];
    try {
      const service = await getWorkspace();
      await service.reorderCompositionEntries(activeDocument.id, ordered.map((entry) => entry.id));
      setCompositionEntries(ordered.map((entry, order) => ({ ...entry, order })));
      setProjectComposition((current) => current.map((entry) => {
        const updated = ordered.find((item) => item.id === entry.id);
        return updated ? { ...entry, order: updated.order } : entry;
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo reordenar la composición.");
    }
  }

  async function removeComposedFragment(entryId: Id) {
    if (!activeDocument) return;
    try {
      const service = await getWorkspace();
      await service.removeCompositionEntry(activeDocument.id, entryId);
      const remaining = compositionEntries.filter((entry) => entry.id !== entryId)
        .map((entry, order) => ({ ...entry, order }));
      await service.reorderCompositionEntries(activeDocument.id, remaining.map((entry) => entry.id));
      setCompositionEntries(remaining);
      setProjectComposition((current) => current.filter((entry) => entry.id !== entryId).map((entry) =>
        entry.chapterId === activeDocument.id
          ? { ...entry, order: remaining.find((item) => item.id === entry.id)?.order ?? entry.order }
          : entry
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo retirar el fragmento.");
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
        <button
          className="project-button"
          aria-expanded={showProjectMenu}
          onClick={() => setShowProjectMenu((visible) => !visible)}
        >
          <span className="project-dot" />
          <span className="project-button-title">{project?.title ?? "Cargando proyecto…"}</span>
          <span className="chevron">⌄</span>
        </button>
        {showProjectMenu && (
          <div className="project-menu">
            <div className="project-menu-label">TUS PROYECTOS</div>
            {projects.map((item) => (
              <button
                key={item.id}
                className={`project-option ${item.id === project?.id ? "selected" : ""}`}
                onClick={() => void selectProject(item)}
              >
                {item.title}
              </button>
            ))}
            <form
              className="new-project-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createProject();
              }}
            >
              <input
                aria-label="Nombre del nuevo proyecto"
                value={newProjectTitle}
                onChange={(event) => setNewProjectTitle(event.target.value)}
                placeholder="Nuevo proyecto"
              />
              <button type="submit" disabled={!newProjectTitle.trim()}>Crear</button>
            </form>
          </div>
        )}
        <div className="section-heading">
          <span>Biblioteca</span>
          <button
            className="icon-button"
            onClick={() => setShowNewDocumentMenu((visible) => !visible)}
            aria-label="Crear material"
            title="Crear material"
          >
            +
          </button>
        </div>
        {showNewDocumentMenu && (
          <div className="new-document-menu">
            <button onClick={() => { void createDocument("chapter"); setShowNewDocumentMenu(false); }}>Nuevo capítulo</button>
            <button onClick={() => { void createDocument("fragment"); setShowNewDocumentMenu(false); }}>Fragmento suelto</button>
            <button onClick={() => { void createDocument("note"); setShowNewDocumentMenu(false); }}>Nota</button>
          </div>
        )}

        <button
          className={`annex-link ${activeView === "entities" ? "active" : ""}`}
          onClick={() => { setActiveView("entities"); setShowContext(false); }}
        >
          <span>✧</span> Fichas del proyecto <small>{entities.length}</small>
        </button>
        <button
          className={`annex-link ${activeView === "sources" ? "active" : ""}`}
          onClick={() => { setActiveView("sources"); setShowContext(false); }}
        >
          <span>▤</span> Fuentes <small>{sources.length}</small>
        </button>
        <button
          className={`annex-link ${activeView === "notes" ? "active" : ""}`}
          onClick={() => { setActiveView("notes"); setShowContext(false); }}
        >
          <span>▧</span> Notas del autor <small>{authorNotes.length}</small>
        </button>
        <button
          className={`annex-link ${activeView === "tags" ? "active" : ""}`}
          onClick={() => { setActiveView("tags"); setShowContext(false); }}
        >
          <span>⌑</span> Etiquetas <small>{tags.length}</small>
        </button>

        <nav className="document-list" aria-label="Documentos">
          {[...documents].sort((a, b) => {
            if (a.kind === "chapter" && b.kind === "chapter") return (a.order ?? 0) - (b.order ?? 0);
            if (a.kind === "chapter") return -1;
            if (b.kind === "chapter") return 1;
            return a.createdAt.localeCompare(b.createdAt);
          }).map((doc) => (
            <div className="document-row" key={doc.id}>
              <button
                className={`document-item ${doc.id === activeId ? "active" : ""}`}
                onClick={() => { setActiveId(doc.id); setTextSelection(null); setActiveView("writing"); }}
              >
                <span className="document-icon">{doc.kind === "fragment" ? "✳" : doc.kind === "chapter" ? "§" : "▤"}</span>
                <span className="document-info">
                  <span className="document-title">{doc.title || "Sin título"}</span>
                  <span className="document-category">{doc.category}</span>
                </span>
              </button>
              {doc.kind === "chapter" && (
                <div className="chapter-order-controls" aria-label={`Orden de ${doc.title}`}>
                  <button aria-label="Subir capítulo" onClick={() => void moveChapter(doc.id, -1)}>↑</button>
                  <button aria-label="Bajar capítulo" onClick={() => void moveChapter(doc.id, 1)}>↓</button>
                </div>
              )}
            </div>
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
            <span>{project?.title ?? "Mi espacio"}</span>
            <span className="breadcrumb-separator">/</span>
            <span>{activeView === "entities" ? "Fichas del proyecto" : activeView === "sources" ? "Fuentes" : activeView === "notes" ? "Notas del autor" : activeView === "tags" ? "Etiquetas del proyecto" : activeDocument?.category ?? "Documento"}</span>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <input
                aria-label="Buscar en el proyecto"
                value={searchQuery}
                onFocus={() => { if (searchQuery.trim()) setShowSearchResults(true); }}
                onChange={(event) => { setSearchQuery(event.target.value); setShowSearchResults(true); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowSearchResults(false);
                  if (event.key === "Enter" && searchResults[0]) { event.preventDefault(); openSearchResult(searchResults[0]); }
                }}
                placeholder="Buscar en el proyecto…"
              />
              {showSearchResults && searchQuery.trim() && (
                <div className="search-results" role="listbox" aria-label="Resultados de búsqueda">
                  {searchResults.length ? searchResults.slice(0, 30).map((result) => (
                    <button key={`${result.type}:${result.id}`} role="option" aria-selected="false" onClick={() => openSearchResult(result)}>
                      <span><small>{result.type === "document" ? documents.find((item) => item.id === result.id)?.category ?? "Documento" : searchResultType(result.type)}</small><strong>{result.title || "Sin título"}</strong></span>
                      {result.excerpt && <small className="search-result-excerpt">{result.excerpt}</small>}
                      {result.tags.length > 0 && <small className="search-result-tags">{result.tags.map((tag) => `#${tag}`).join(" · ")}</small>}
                    </button>
                  )) : <p>No hay coincidencias en este proyecto.</p>}
                </div>
              )}
            </div>
            <span className="save-status">
              ● {saving ? "Guardando…" : "Almacenamiento en memoria"}
            </span>
            <button
              className="context-toggle"
              onClick={() => setShowContext((visible) => !visible)}
              aria-expanded={showContext}
              aria-controls="context-panel"
            >
              {showContext ? "Cerrar contexto" : "Contexto"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}

        <div className={`editor-layout ${showContext ? "" : "context-hidden"}`}>
          {activeView === "entities" ? (
            <section className="entity-catalog">
              <div className="entity-catalog-heading">
                <span className="eyebrow">ANEXO DEL PROYECTO</span>
                <h1>Fichas</h1>
                <p>Personajes, lugares, historias y otros elementos del proyecto. Cada ficha se conserva una sola vez y enlaza con los textos donde aparece.</p>
                <form className="entity-catalog-create" onSubmit={(event) => { event.preventDefault(); void createEntity(); }}>
                  <select aria-label="Tipo de ficha nueva" value={newEntityKind} onChange={(event) => setNewEntityKind(event.target.value as KnowledgeEntity["kind"])}>
                    <option value="character">Personaje</option><option value="place">Lugar</option><option value="story">Historia</option>
                    <option value="event">Acontecimiento</option><option value="concept">Concepto</option><option value="person">Persona</option>
                    <option value="organization">Organización</option><option value="other">Otro</option>
                  </select>
                  <input aria-label="Nombre de nueva ficha" value={newEntityTitle} onChange={(event) => setNewEntityTitle(event.target.value)} placeholder="Nombre de la ficha" />
                  <button type="submit" disabled={!newEntityTitle.trim()}>Crear ficha</button>
                </form>
              </div>
              {entities.length === 0 ? (
                <div className="entity-catalog-empty">Todavía no hay fichas. Usa «Crear ficha» para añadir la primera.</div>
              ) : (
                <div className="entity-card-list">
                  {entities.map((entity) => (
                    <details className="entity-card" id={`catalog-entity-${entity.id}`} key={entity.id} open={selectedEntityId === entity.id}>
                      <summary>
                        <span className="entity-kind-label">{entityKindLabel(entity.kind)}</span>
                        <strong>{entity.title}</strong>
                        <span className="entity-usage-count">{entityUsage(entity.id).length} vínculos</span>
                        <span className="catalog-order-controls">
                          <button aria-label="Subir ficha" disabled={entities.findIndex((item) => item.id === entity.id) === 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("entity", entity.id, -1); }}>↑</button>
                          <button aria-label="Bajar ficha" disabled={entities.findIndex((item) => item.id === entity.id) === entities.length - 1} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("entity", entity.id, 1); }}>↓</button>
                        </span>
                      </summary>
                      <div className="entity-card-editor">
                        <label>
                          Nombre
                          <input value={entity.title} onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, title: event.target.value }))} />
                        </label>
                        <label>
                          Tipo de ficha
                          <select value={entity.kind} onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, kind: event.target.value as KnowledgeEntity["kind"] }))}>
                            <option value="character">Personaje</option><option value="place">Lugar</option><option value="story">Historia</option>
                            <option value="event">Acontecimiento</option><option value="concept">Concepto</option><option value="person">Persona</option>
                            <option value="organization">Organización</option><option value="other">Otro</option>
                          </select>
                        </label>
                        <label>
                          Información principal
                          <textarea value={entity.description ?? ""} onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, description: event.target.value }))} placeholder="Descripción, historia, recordatorios…" rows={4} />
                        </label>
                        <div className="entity-fields">
                          <div className="entity-fields-heading"><strong>Detalles</strong><button onClick={() => updateEntityDraft(entity.id, (current) => ({ ...current, details: [...(current.details ?? []), { label: "", value: "" }] }))}>+ Añadir campo</button></div>
                          {(entity.details ?? []).map((detail, index) => (
                            <div className="entity-detail-row" key={`${entity.id}-detail-${index}`}>
                              <input aria-label="Nombre del detalle" value={detail.label} placeholder="Personalidad, aspecto…" onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, details: (current.details ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
                              <textarea aria-label="Valor del detalle" value={detail.value} placeholder="Información para recordar" rows={2} onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, details: (current.details ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} />
                              <button aria-label="Eliminar detalle" onClick={() => updateEntityDraft(entity.id, (current) => ({ ...current, details: (current.details ?? []).filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
                            </div>
                          ))}
                        </div>
                        <div className="entity-fields">
                          <div className="entity-fields-heading"><strong>Enlaces externos</strong><button onClick={() => updateEntityDraft(entity.id, (current) => ({ ...current, externalLinks: [...(current.externalLinks ?? []), { label: "", url: "" }] }))}>+ Añadir enlace</button></div>
                          {(entity.externalLinks ?? []).map((link, index) => (
                            <div className="entity-link-row" key={`${entity.id}-link-${index}`}>
                              <input aria-label="Etiqueta del enlace" value={link.label} placeholder="Wikipedia, Google Maps…" onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, externalLinks: (current.externalLinks ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
                              <input aria-label="Dirección del enlace" value={link.url} placeholder="https://…" onChange={(event) => updateEntityDraft(entity.id, (current) => ({ ...current, externalLinks: (current.externalLinks ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} />
                              <button aria-label="Eliminar enlace" onClick={() => updateEntityDraft(entity.id, (current) => ({ ...current, externalLinks: (current.externalLinks ?? []).filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
                            </div>
                          ))}
                          {(entity.externalLinks ?? []).filter((link) => link.label && link.url).map((link, index) => <a className="entity-external-link" key={`${entity.id}-external-${index}`} href={link.url} target="_blank" rel="noreferrer">↗ {link.label}</a>)}
                        </div>
                        <TagSelector tags={tags} selectedIds={assignedTagIds("entity", entity.id)} onToggle={(tagId) => void toggleTagAssignment("entity", entity.id, tagId)} onManage={() => { setActiveView("tags"); setShowContext(false); }} />
                        <div className="entity-backlinks">
                          <strong>Usos en el proyecto</strong>
                          {entityUsage(entity.id).length === 0 ? <span className="field-hint">Aún no está vinculada a documentos.</span> : entityUsage(entity.id).map(({ document, relationship, anchor, note }) => (
                            <button key={`${entity.id}-${document.id}`} onClick={() => openDocumentAtAnchor(anchor?.documentId ?? document.id, anchor)}>
                              {document.kind === "chapter" ? "Capítulo" : document.kind === "fragment" ? "Fragmento" : "Documento"}: {document.title} <small>· {relationship}{anchor?.quote ? ` · «${anchor.quote}»` : ""}{note ? ` · ${note}` : ""}</small>
                            </button>
                          ))}
                        </div>
                        <div className="catalog-card-actions">
                          <button className="primary-button entity-save-button" onClick={() => void saveEntity(entity)}>Guardar ficha</button>
                          <button className="danger-button" onClick={() => void deleteEntity(entity)}>Eliminar ficha</button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ) : activeView === "sources" ? (
            <section className="entity-catalog source-catalog">
              <div className="entity-catalog-heading">
                <span className="eyebrow">BIBLIOTECA DE REFERENCIA</span>
                <h1>Fuentes</h1>
                <p>Referencias y materiales externos del proyecto. Los datos bibliográficos se conservan por separado de los pasajes que citan.</p>
                <form className="entity-catalog-create source-catalog-create" onSubmit={(event) => { event.preventDefault(); void createSource(); }}>
                  <input aria-label="Título de nueva fuente" value={newSourceTitle} onChange={(event) => setNewSourceTitle(event.target.value)} placeholder="Título de la fuente" />
                  <input aria-label="Autor de nueva fuente" value={newSourceAuthor} onChange={(event) => setNewSourceAuthor(event.target.value)} placeholder="Autor" />
                  <input aria-label="URL de nueva fuente" value={newSourceUrl} onChange={(event) => setNewSourceUrl(event.target.value)} placeholder="URL https://…" />
                  <input aria-label="DOI de nueva fuente" value={newSourceDoi} onChange={(event) => setNewSourceDoi(event.target.value)} placeholder="DOI (opcional)" />
                  <button type="submit" disabled={!newSourceTitle.trim()}>Añadir fuente</button>
                </form>
              </div>
              {sources.length === 0 ? (
                <div className="entity-catalog-empty">Todavía no hay fuentes. Usa el formulario superior o añade una cita desde un documento.</div>
              ) : (
                <div className="entity-card-list">
                  {sources.map((source) => (
                    <details className="entity-card source-card" id={`catalog-source-${source.id}`} key={source.id} open={selectedSourceId === source.id}>
                      <summary>
                        <span className="entity-kind-label">Fuente</span>
                        <strong>{source.title}</strong>
                        <span className="entity-usage-count">{relations.filter((relation) => (relation.fromType === "source" && relation.fromId === source.id) || (relation.toType === "source" && relation.toId === source.id)).length} vínculos</span>
                        <span className="catalog-order-controls">
                          <button aria-label="Subir fuente" disabled={sources.findIndex((item) => item.id === source.id) === 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("source", source.id, -1); }}>↑</button>
                          <button aria-label="Bajar fuente" disabled={sources.findIndex((item) => item.id === source.id) === sources.length - 1} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("source", source.id, 1); }}>↓</button>
                        </span>
                      </summary>
                      <div className="entity-card-editor">
                        <label>Título<input value={source.title} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, title: event.target.value } : item))} /></label>
                        <label>Autoría<input value={source.author ?? ""} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, author: event.target.value } : item))} /></label>
                        <div className="source-metadata-row">
                          <label>Editorial<input value={source.publisher ?? ""} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, publisher: event.target.value } : item))} /></label>
                          <label>Año<input value={source.year ?? ""} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, year: event.target.value } : item))} /></label>
                          <label>DOI<input value={source.doi ?? ""} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, doi: event.target.value } : item))} /></label>
                        </div>
                        <label>URL<input value={source.url ?? ""} placeholder="https://…" onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, url: event.target.value } : item))} /></label>
                        {source.url && <a className="entity-external-link" href={source.url} target="_blank" rel="noreferrer">↗ Abrir fuente</a>}
                        <label>Cita / localizador<textarea value={source.citation ?? ""} rows={3} onChange={(event) => setSources((current) => current.map((item) => item.id === source.id ? { ...item, citation: event.target.value } : item))} /></label>
                        <TagSelector tags={tags} selectedIds={assignedTagIds("source", source.id)} onToggle={(tagId) => void toggleTagAssignment("source", source.id, tagId)} onManage={() => { setActiveView("tags"); setShowContext(false); }} />
                        <div className="entity-backlinks">
                          <strong>Vinculada desde</strong>
                          {sourceUsage(source.id).map(({ document, relationship, anchor, note }) => {
                            return <button key={`${source.id}-${document.id}`} onClick={() => openDocumentAtAnchor(anchor?.documentId ?? document.id, anchor)}>{document.category}: {document.title}<small> · {relationship}{anchor?.quote ? ` · «${anchor.quote}»` : ""}{note ? ` · ${note}` : ""}</small></button>;
                          })}
                        </div>
                        <div className="catalog-card-actions">
                          <button className="primary-button entity-save-button" onClick={() => void saveSource(source)}>Guardar fuente</button>
                          <button className="danger-button" onClick={() => void deleteSource(source)}>Eliminar fuente</button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ) : activeView === "tags" ? (
            <section className="entity-catalog tag-catalog">
              <div className="entity-catalog-heading">
                <span className="eyebrow">ORGANIZACIÓN DEL PROYECTO</span>
                <h1>Etiquetas</h1>
                <p>Las etiquetas agrupan elementos de tipos distintos sin cambiar sus relaciones. Por ejemplo, «investigar» puede reunir un fragmento, una fuente y una ficha; después basta buscar esa etiqueta para encontrarlos juntos.</p>
                <p className="tag-how-to">Crea aquí las etiquetas. Luego abre un documento, ficha, fuente o nota y pulsa la etiqueta para asignarla o quitarla.</p>
                <form className="entity-catalog-create tag-create-form" onSubmit={(event) => { event.preventDefault(); void createProjectTag(); }}>
                  <input aria-label="Nombre de la etiqueta" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Nueva etiqueta" />
                  <button type="submit" disabled={!newTagName.trim()}>Crear etiqueta</button>
                </form>
              </div>
              {tags.length === 0 ? (
                <div className="entity-catalog-empty">Aún no hay etiquetas. Puedes usar categorías como «borrador», «investigar» o «revisar».</div>
              ) : (
                <div className="tag-catalog-list">
                  {tags.map((tag) => (
                    <div className="tag-catalog-row" key={tag.id}>
                      <input aria-label={`Nombre de ${tag.name}`} value={tagNameDrafts[tag.id] ?? tag.name} onChange={(event) => setTagNameDrafts((current) => ({ ...current, [tag.id]: event.target.value }))} />
                      <span>{tagAssignments.filter((item) => item.tagId === tag.id).length} elementos</span>
                      <button onClick={() => void saveProjectTag(tag)} disabled={!((tagNameDrafts[tag.id] ?? tag.name).trim()) || (tagNameDrafts[tag.id] ?? tag.name) === tag.name}>Guardar nombre</button>
                      <button className="danger-button" onClick={() => void deleteProjectTag(tag)}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : activeView === "notes" ? (
            <section className="note-board">
              <div className="entity-catalog-heading">
                <span className="eyebrow">ESPACIO AUXILIAR</span>
                <h1>Notas del autor</h1>
                <p>Recordatorios que permanecen fuera del manuscrito. Puedes vincularlos a un elemento o dejarlos asociados al proyecto completo.</p>
              </div>
              <form className="note-create-form" onSubmit={(event) => { event.preventDefault(); void createAuthorNote(); }}>
                <textarea aria-label="Nueva nota del autor" value={newNoteContent} onChange={(event) => setNewNoteContent(event.target.value)} placeholder="Una idea, pregunta o recordatorio…" rows={3} />
                <div className="note-create-controls">
                  <select aria-label="Color de la nota" value={newNoteColor} onChange={(event) => setNewNoteColor(event.target.value as AuthorNoteColor)}>
                    <option value="sand">Arena</option><option value="sage">Salvia</option><option value="rose">Rosa</option><option value="sky">Azul</option>
                  </select>
                  <select aria-label="Vincular nota" value={newNoteTarget} onChange={(event) => setNewNoteTarget(event.target.value)}>
                    <option value="">Todo el proyecto</option>
                    {documents.map((document) => <option key={document.id} value={`${document.kind === "fragment" ? "fragment" : "document"}:${document.id}`}>{document.category}: {document.title}</option>)}
                    {entities.map((entity) => <option key={entity.id} value={`entity:${entity.id}`}>Ficha: {entity.title}</option>)}
                    {sources.map((source) => <option key={source.id} value={`source:${source.id}`}>Fuente: {source.title}</option>)}
                  </select>
                  <button type="submit" disabled={!newNoteContent.trim()}>Añadir nota</button>
                </div>
              </form>
              {authorNotes.length === 0 ? (
                <div className="entity-catalog-empty">Aún no hay notas. Las tarjetas que añadas aquí no se incorporan al texto de tus documentos.</div>
              ) : (
                <div className="note-card-grid">
                  {authorNotes.map((note) => (
                    <details className={`author-note note-${note.color}`} id={`catalog-note-${note.id}`} key={note.id} open={selectedNoteId === note.id} onToggle={(event) => { const isOpen = event.currentTarget.open; setSelectedNoteId((current) => isOpen ? note.id : current === note.id ? null : current); }}>
                      <summary className="author-note-summary">
                        <span>{note.content.split("\n")[0] || "Nota del autor"}</span>
                        <span className="note-order-controls">
                          <button aria-label="Subir nota" disabled={authorNotes.findIndex((item) => item.id === note.id) === 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("note", note.id, -1); }}>↑</button>
                          <button aria-label="Bajar nota" disabled={authorNotes.findIndex((item) => item.id === note.id) === authorNotes.length - 1} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCatalogItem("note", note.id, 1); }}>↓</button>
                        </span>
                      </summary>
                      <div className="author-note-body">
                      <div className="author-note-header">
                        {note.targetId ? <button onClick={() => openAuthorNoteTarget(note)}>↗ {authorNoteTarget(note)}</button> : <span>Proyecto</span>}
                        <select className="note-target-select" aria-label="Reasignar nota" value={note.targetType && note.targetId ? `${note.targetType}:${note.targetId}` : ""} onChange={(event) => {
                          const [targetType, targetId] = event.target.value ? event.target.value.split(":", 2) : [];
                          setAuthorNotes((current) => current.map((item) => item.id === note.id ? { ...item, targetType: targetType as AuthorNote["targetType"], targetId } : item));
                        }}>
                          <option value="">Proyecto</option>
                          {documents.map((document) => <option key={document.id} value={`${document.kind === "fragment" ? "fragment" : "document"}:${document.id}`}>{document.category}: {document.title}</option>)}
                          {entities.map((entity) => <option key={entity.id} value={`entity:${entity.id}`}>Ficha: {entity.title}</option>)}
                          {sources.map((source) => <option key={source.id} value={`source:${source.id}`}>Fuente: {source.title}</option>)}
                        </select>
                        <select aria-label="Color de la nota" value={note.color} onChange={(event) => setAuthorNotes((current) => current.map((item) => item.id === note.id ? { ...item, color: event.target.value as AuthorNoteColor } : item))}>
                          <option value="sand">Arena</option><option value="sage">Salvia</option><option value="rose">Rosa</option><option value="sky">Azul</option>
                        </select>
                      </div>
                      <textarea aria-label="Texto de la nota" rows={5} value={note.content} onChange={(event) => setAuthorNotes((current) => current.map((item) => item.id === note.id ? { ...item, content: event.target.value } : item))} />
                      <TagSelector tags={tags} selectedIds={assignedTagIds("author_note", note.id)} onToggle={(tagId) => void toggleTagAssignment("author_note", note.id, tagId)} onManage={() => { setActiveView("tags"); setShowContext(false); }} />
                      <div className="author-note-footer">
                        <span>{new Date(note.updatedAt).toLocaleDateString("es-ES")}</span>
                        <button onClick={() => void saveAuthorNote(note)}>Guardar</button>
                        <button aria-label="Eliminar nota" onClick={() => void deleteAuthorNote(note.id)}>Eliminar</button>
                      </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ) : (
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
                  ref={editorRef}
                  className="document-editor"
                  aria-label="Contenido del documento"
                  value={activeDocument.text}
                  onChange={(event) =>
                    updateActiveDocument("text", event.target.value)
                  }
                  onSelect={(event) => {
                    const { selectionStart, selectionEnd } = event.currentTarget;
                    setTextSelection(selectionEnd > selectionStart ? { start: selectionStart, end: selectionEnd } : null);
                  }}
                  onBlur={() => void saveActiveDocument()}
                  placeholder="Empieza a escribir tus ideas..."
                  spellCheck
                />

                <div className="editor-footer">
                  <span>Los cambios se guardan al salir del campo.</span>
                  <span>{activeDocument.text.length} caracteres</span>
                </div>
                {activeDocument.kind === "fragment" && (
                  <section className="fragment-chapter-navigation" aria-label="Capítulos que incluyen este fragmento">
                    <h2>Incluido en capítulos</h2>
                    {fragmentChapterIds.length ? fragmentChapterIds.map((chapterId) => {
                      const chapter = documents.find((item) => item.id === chapterId);
                      return chapter ? <button key={chapterId} onClick={() => { setActiveId(chapter.id); setTextSelection(null); }}>§ {chapter.title}</button> : null;
                    }) : <span>Este fragmento todavía no está incluido en ningún capítulo.</span>}
                  </section>
                )}
                {activeDocument.kind === "chapter" && compositionEntries.length > 0 && (
                  <section className="chapter-composition" aria-label="Fragmentos incorporados">
                    <h2>Piezas de este capítulo</h2>
                    {compositionEntries.map((entry) => {
                      const fragment = documents.find((item) => item.id === entry.fragmentId);
                      return fragment ? (
                        <button key={entry.id} className="composed-fragment" onClick={() => { setActiveId(fragment.id); setTextSelection(null); }}>
                          <strong>{fragment.title}</strong>
                          <span>{fragment.text.slice(0, 180) || "Fragmento vacío"}</span>
                        </button>
                      ) : null;
                    })}
                  </section>
                )}
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
          )}

          {showContext && (
            <aside className="context-panel" id="context-panel">
              <div className="context-header">
                <span className="eyebrow">PANEL CONTEXTUAL</span>
                <span className="context-menu">···</span>
              </div>
              <details className="context-section project-context" open={contextSectionsOpen.project} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, project: isOpen })); }}>
                <summary className="context-section-title">
                  <span className="context-symbol">⌘</span>
                  <h2>Contexto del proyecto</h2>
                </summary>

                {contextDraft && (
                  <div className="context-form">
                    <label>
                      Nombre del proyecto
                      <input
                        value={projectTitleDraft}
                        onChange={(event) => setProjectTitleDraft(event.target.value)}
                        placeholder="Nombre del proyecto"
                      />
                    </label>
                    <label>
                      Tipo de proyecto
                      <select
                        value={contextDraft.kind}
                        onChange={(event) =>
                          setContextDraft({
                            ...contextDraft,
                            kind: event.target.value as ProjectContext["kind"]
                          })
                        }
                      >
                        <option value="fiction">Ficción</option>
                        <option value="research">Investigación</option>
                        <option value="essay">Ensayo</option>
                        <option value="report">Informe</option>
                        <option value="documentation">Documentación</option>
                        <option value="other">Otro</option>
                      </select>
                    </label>

                    <label>
                      Idioma principal
                      <input
                        value={contextDraft.primaryLanguage === "und"
                          ? ""
                          : contextDraft.primaryLanguage}
                        onChange={(event) =>
                          setContextDraft({
                            ...contextDraft,
                            primaryLanguage: event.target.value || "und"
                          })
                        }
                        placeholder="es, fr, en…"
                      />
                    </label>

                    <label>
                      Idiomas adicionales
                      <input
                        value={contextDraft.additionalLanguages.join(", ")}
                        onChange={(event) =>
                          setContextDraft({
                            ...contextDraft,
                            additionalLanguages: event.target.value
                              .split(",")
                              .map((language) => language.trim())
                              .filter(Boolean)
                          })
                        }
                        placeholder="fr, en…"
                      />
                      <span className="field-hint">
                        Separa los idiomas con comas.
                      </span>
                    </label>

                    <label>
                      Estilo editorial
                      <select
                        value={contextDraft.editorialStyle}
                        onChange={(event) =>
                          setContextDraft({
                            ...contextDraft,
                            editorialStyle:
                              event.target.value as ProjectContext["editorialStyle"]
                          })
                        }
                      >
                        <option value="classic">Clásico</option>
                        <option value="modern">Moderno</option>
                      </select>
                    </label>

                    <button
                      className="primary-button context-save-button"
                        disabled={savingContext || !projectTitleDraft.trim()}
                      onClick={() => void saveProjectContext()}
                    >
                      {savingContext ? "Guardando…" : "Guardar contexto"}
                    </button>
                  </div>
                )}
              </details>
              {activeDocument && <details className="context-section" open={contextSectionsOpen.tags} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, tags: isOpen })); }}>
                <summary className="context-section-title"><span className="context-symbol">⌑</span><h2>Etiquetas</h2></summary>
                <TagSelector tags={tags} selectedIds={assignedTagIds("document", activeDocument.id)} onToggle={(tagId) => void toggleTagAssignment("document", activeDocument.id, tagId)} onManage={() => { setActiveView("tags"); setShowContext(false); }} />
              </details>}
              <details className="context-section" open={contextSectionsOpen.entities} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, entities: isOpen })); }}>
                <summary className="context-section-title">
                  <span className="context-symbol">◇</span>
                  <h2>Fichas vinculadas</h2>
                </summary>
                {activeDocument && relations.filter((relation) =>
                  (relation.fromId === activeDocument.id && relation.fromType === "document") ||
                  (relation.toId === activeDocument.id && relation.toType === "document")
                ).filter((relation) => relation.fromType === "entity" || relation.toType === "entity").map((relation) => (
                  <div className="linked-relation" key={relation.id}>
                    <div className="linked-item">
                      <button className="linked-item-target" onClick={() => openRelationTarget(relation)}>{relationTargetTitle(relation)} <small>· {relation.kind.replaceAll("_", " ")}{relation.anchor?.quote ? ` · «${relation.anchor.quote}»` : ""}</small></button>
                      <button aria-label="Quitar relación" onClick={() => void removeRelation(relation.id)}>×</button>
                    </div>
                    <input className="relation-note-input" aria-label={`Explicación de la relación con ${relationTargetTitle(relation)}`} value={relation.note ?? ""} onChange={(event) => setRelations((current) => current.map((item) => item.id === relation.id ? { ...item, note: event.target.value } : item))} onBlur={(event) => void saveRelationNote(relation.id, event.currentTarget.value)} placeholder="¿Por qué importa este vínculo? (opcional)" />
                  </div>
                ))}
                <form className="context-create-form" onSubmit={(event) => { event.preventDefault(); void createEntity(); }}>
                  <p className="field-hint">Selecciona un pasaje antes de vincular para que el regreso desde la ficha vaya directamente a ese punto.</p>
                  <select aria-label="Tipo de ficha" value={newEntityKind} onChange={(event) => setNewEntityKind(event.target.value as KnowledgeEntity["kind"])}>
                    <option value="character">Personaje</option><option value="place">Lugar</option>
                    <option value="event">Acontecimiento</option><option value="concept">Concepto</option>
                    <option value="story">Historia</option>
                    <option value="person">Persona</option><option value="organization">Organización</option><option value="other">Otro</option>
                  </select>
                  <input aria-label="Nombre de la ficha" value={newEntityTitle} onChange={(event) => setNewEntityTitle(event.target.value)} placeholder="Nueva ficha" />
                  <button type="submit" disabled={!newEntityTitle.trim()}>Añadir</button>
                </form>
                {activeDocument && entities.some((entity) => !relations.some((relation) => relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === "entity" && relation.toId === entity.id)) && (
                  <div className="context-create-form">
                    <p className="field-hint">Con un pasaje seleccionado, el vínculo volverá directamente a ese texto.</p>
                    <select aria-label="Ficha existente para vincular" value={entityToLink} onChange={(event) => setEntityToLink(event.target.value)}>
                      <option value="">Vincular ficha existente…</option>
                      {entities.filter((entity) => !relations.some((relation) => relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === "entity" && relation.toId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entityKindLabel(entity.kind)}: {entity.title}</option>)}
                    </select>
                    <button onClick={() => void linkExistingItem("entity", entityToLink)} disabled={!entityToLink}>Vincular</button>
                  </div>
                )}
              </details>

              <details className="context-section" open={contextSectionsOpen.sources} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, sources: isOpen })); }}>
                <summary className="context-section-title">
                  <span className="context-symbol">▤</span>
                  <h2>Fuentes</h2>
                </summary>
                {activeDocument && relations.filter((relation) =>
                  (relation.fromId === activeDocument.id && relation.fromType === "document") ||
                  (relation.toId === activeDocument.id && relation.toType === "document")
                ).filter((relation) => relation.fromType === "source" || relation.toType === "source").map((relation) => (
                  <div className="linked-relation" key={relation.id}>
                    <div className="linked-item">
                      <button className="linked-item-target" onClick={() => openRelationTarget(relation)}>{relationTargetTitle(relation)} <small>· {relation.anchor?.quote ?? "cita / apoyo"}</small></button>
                      <button aria-label="Quitar referencia" onClick={() => void removeRelation(relation.id)}>×</button>
                    </div>
                    <input className="relation-note-input" aria-label={`Explicación de la relación con ${relationTargetTitle(relation)}`} value={relation.note ?? ""} onChange={(event) => setRelations((current) => current.map((item) => item.id === relation.id ? { ...item, note: event.target.value } : item))} onBlur={(event) => void saveRelationNote(relation.id, event.currentTarget.value)} placeholder="¿Qué aporta esta fuente aquí? (opcional)" />
                  </div>
                ))}
                <form className="context-create-form" onSubmit={(event) => { event.preventDefault(); void createSource(); }}>
                  <p className="field-hint">Selecciona un pasaje en el texto para asociar la referencia a esa cita.</p>
                  <input aria-label="Título de la fuente" value={newSourceTitle} onChange={(event) => setNewSourceTitle(event.target.value)} placeholder="Título de la fuente" />
                  <input aria-label="Autor de la fuente" value={newSourceAuthor} onChange={(event) => setNewSourceAuthor(event.target.value)} placeholder="Autor" />
                  <input aria-label="URL de la fuente" value={newSourceUrl} onChange={(event) => setNewSourceUrl(event.target.value)} placeholder="URL https://…" />
                  <input aria-label="DOI de la fuente" value={newSourceDoi} onChange={(event) => setNewSourceDoi(event.target.value)} placeholder="DOI" />
                  <input aria-label="Cita o localizador" value={newSourceCitation} onChange={(event) => setNewSourceCitation(event.target.value)} placeholder="Cita o página" />
                  <button type="submit" disabled={!newSourceTitle.trim()}>Guardar fuente</button>
                </form>
                {activeDocument && sources.some((source) => !relations.some((relation) => relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === "source" && relation.toId === source.id)) && (
                  <div className="context-create-form">
                    <select aria-label="Fuente existente para vincular" value={sourceToLink} onChange={(event) => setSourceToLink(event.target.value)}>
                      <option value="">Vincular fuente existente…</option>
                      {sources.filter((source) => !relations.some((relation) => relation.fromType === "document" && relation.fromId === activeDocument.id && relation.toType === "source" && relation.toId === source.id)).map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                    </select>
                    <button onClick={() => void linkExistingItem("source", sourceToLink)} disabled={!sourceToLink}>Vincular</button>
                  </div>
                )}
              </details>

              {(activeDocument?.kind === "chapter" || activeDocument?.kind === "fragment") && (
                <details className="context-section" open={contextSectionsOpen.composition} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, composition: isOpen })); }}>
                  <summary className="context-section-title">
                    <span className="context-symbol">↔</span>
                    <h2>Composición</h2>
                  </summary>
                  {activeDocument.kind === "chapter" ? (
                    <>
                      {compositionEntries.map((entry, index) => {
                        const fragment = documents.find((item) => item.id === entry.fragmentId);
                        return (
                          <div className="linked-item" key={entry.id}>
                            <button className="linked-item-target" onClick={() => { if (fragment) { setActiveId(fragment.id); setActiveView("writing"); setTextSelection(null); } }}>{fragment?.title ?? "Fragmento"}</button>
                            <div className="composition-controls">
                              <button aria-label="Subir fragmento" disabled={index === 0} onClick={() => void moveComposedFragment(entry.id, -1)}>↑</button>
                              <button aria-label="Bajar fragmento" disabled={index === compositionEntries.length - 1} onClick={() => void moveComposedFragment(entry.id, 1)}>↓</button>
                              <button aria-label="Retirar del capítulo" onClick={() => void removeComposedFragment(entry.id)}>×</button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="context-create-form">
                        <select aria-label="Fragmento para incorporar" value={fragmentToInclude} onChange={(event) => setFragmentToInclude(event.target.value)}>
                          <option value="">Elegir fragmento suelto…</option>
                          {documents.filter((item) => item.kind === "fragment").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                        </select>
                        <button onClick={() => void includeFragment()} disabled={!fragmentToInclude}>Incorporar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      {fragmentChapterIds.length === 0 ? (
                        <p className="muted-copy fragment-usage-empty">Este fragmento aún no forma parte de ningún capítulo.</p>
                      ) : (
                        <div className="fragment-usage-list">
                          <span className="field-hint">Incluido en:</span>
                          {fragmentChapterIds.map((chapterId) => {
                            const chapter = documents.find((item) => item.id === chapterId);
                            return chapter ? (
                              <button key={chapterId} className="fragment-usage-link" onClick={() => { setActiveId(chapterId); setTextSelection(null); }}>
                                § {chapter.title}
                              </button>
                            ) : null;
                          })}
                        </div>
                      )}
                      <div className="context-create-form">
                        <select aria-label="Capítulo de destino" value={chapterToIncludeIn} onChange={(event) => setChapterToIncludeIn(event.target.value)}>
                          <option value="">Elegir capítulo…</option>
                          {documents.filter((item) => item.kind === "chapter").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                        </select>
                        <button onClick={() => void includeFragment()} disabled={!chapterToIncludeIn}>Añadir al capítulo</button>
                      </div>
                    </>
                  )}
                </details>
              )}

              <details className="context-section" open={contextSectionsOpen.activity} onToggle={(event) => { const isOpen = event.currentTarget.open; setContextSectionsOpen((current) => ({ ...current, activity: isOpen })); }}>
                <summary className="context-section-title">
                  <span className="context-symbol">◷</span>
                  <h2>Historial de versiones</h2>
                </summary>
                {activeDocument && activeView === "writing" ? (
                  <>
                    <p className="muted-copy">Guarda un punto de recuperación antes de hacer cambios importantes. Al restaurar, el estado actual también se conserva.</p>
                    <form className="version-create-form" onSubmit={(event) => { event.preventDefault(); void saveVersion(); }}>
                      <input aria-label="Nombre de la versión" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="Nombre opcional, por ejemplo: Primer borrador" />
                      <textarea aria-label="Nota de la versión" value={versionNote} onChange={(event) => setVersionNote(event.target.value)} rows={2} placeholder="Nota para recordar qué cambió…" />
                      <button className="primary-button" type="submit" disabled={saving}>Guardar versión</button>
                    </form>
                    {documentVersions.length === 0 ? (
                      <p className="version-empty">Todavía no hay versiones guardadas.</p>
                    ) : (
                      <div className="version-list">
                        {documentVersions.map((version) => (
                          <details className="version-card" key={version.id}>
                            <summary>
                              <strong>{version.label || version.title || "Documento sin título"}</strong>
                              <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</time>
                            </summary>
                            <div className="version-card-content">
                              {version.note && <p>{version.note}</p>}
                              <div className="version-preview">{version.text || "Versión vacía"}</div>
                              <button className="version-restore-button" onClick={() => void restoreVersion(version)} disabled={saving}>Recuperar esta versión</button>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </>
                ) : <p className="muted-copy">Selecciona un documento para consultar su historial.</p>}
              </details>

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
