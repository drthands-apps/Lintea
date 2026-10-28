
import { describe, expect, it } from "vitest";
import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";

function createService() {
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  const storage = new MemoryProjectStorage();
  const service = new WorkspaceService(storage, now);
  return { storage, service };
}

async function seed(service: WorkspaceService) {
  const project = await service.createProject({ title: "Proyecto" });
  const chapterA = await service.createDocument({ projectId: project.id, title: "Cap A", kind: "chapter", order: 0 });
  const chapterB = await service.createDocument({ projectId: project.id, title: "Cap B", kind: "chapter", order: 1 });
  const fragment1 = await service.createDocument({ projectId: project.id, title: "Frag 1", kind: "fragment", text: "uno" });
  const fragment2 = await service.createDocument({ projectId: project.id, title: "Frag 2", kind: "fragment", text: "dos" });
  return { project, chapterA, chapterB, fragment1, fragment2 };
}

describe("composición de capítulos", () => {
  it("incluye un fragmento y lo lista en orden", async () => {
    const { service } = createService();
    const { chapterA, fragment1 } = await seed(service);
    const entry = await service.includeFragmentInChapter(chapterA.id, fragment1.id);
    expect(entry.order).toBe(0);
    const entries = await service.listCompositionEntries(chapterA.id);
    expect(entries.map((e) => e.fragmentId)).toEqual([fragment1.id]);
  });

  it("permite el mismo fragmento en dos capítulos sin duplicar el registro", async () => {
    const { service } = createService();
    const { chapterA, chapterB, fragment1 } = await seed(service);
    const a = await service.includeFragmentInChapter(chapterA.id, fragment1.id);
    const b = await service.includeFragmentInChapter(chapterB.id, fragment1.id);
    expect(a.id).not.toBe(b.id);
    const entriesA = await service.listCompositionEntries(chapterA.id);
    const entriesB = await service.listCompositionEntries(chapterB.id);
    expect(entriesA).toHaveLength(1);
    expect(entriesB).toHaveLength(1);
    // El fragmento original sigue existiendo una sola vez.
    const documents = await service.listDocuments((await service.listProjects())[0]!.id);
    expect(documents.filter((d) => d.id === fragment1.id)).toHaveLength(1);
  });

  it("reordena las piezas del capítulo", async () => {
    const { service } = createService();
    const { chapterA, fragment1, fragment2 } = await seed(service);
    const e1 = await service.includeFragmentInChapter(chapterA.id, fragment1.id);
    const e2 = await service.includeFragmentInChapter(chapterA.id, fragment2.id);
    await service.reorderCompositionEntries(chapterA.id, [e2.id, e1.id]);
    const entries = await service.listCompositionEntries(chapterA.id);
    expect(entries.map((e) => e.fragmentId)).toEqual([fragment2.id, fragment1.id]);
  });

  it("rechaza reordenar con un ID que no pertenece al capítulo", async () => {
    const { service } = createService();
    const { chapterA, fragment1 } = await seed(service);
    const e1 = await service.includeFragmentInChapter(chapterA.id, fragment1.id);
    await expect(
      service.reorderCompositionEntries(chapterA.id, [e1.id, "id-ajeno"])
    ).rejects.toThrow();
  });

  it("retira una pieza y compacta el orden", async () => {
    const { service } = createService();
    const { chapterA, fragment1, fragment2 } = await seed(service);
    const e1 = await service.includeFragmentInChapter(chapterA.id, fragment1.id);
    const e2 = await service.includeFragmentInChapter(chapterA.id, fragment2.id);
    await service.removeCompositionEntry(chapterA.id, e1.id);
    const remaining = await service.listCompositionEntries(chapterA.id);
    expect(remaining.map((e) => e.id)).toEqual([e2.id]);
  });

  it("rechaza incluir si los tipos no son capítulo y fragmento", async () => {
    const { service } = createService();
    const { chapterA, chapterB } = await seed(service);
    await expect(
      service.includeFragmentInChapter(chapterA.id, chapterB.id)
    ).rejects.toThrow("Selecciona un capítulo y un fragmento independiente.");
  });

  it("rechaza incluir elementos de proyectos distintos", async () => {
    const { service } = createService();
    const a = await seed(service);
    const other = await service.createProject({ title: "Otro" });
    const foreignFragment = await service.createDocument({ projectId: other.id, title: "Frag externo", kind: "fragment" });
    await expect(
      service.includeFragmentInChapter(a.chapterA.id, foreignFragment.id)
    ).rejects.toThrow("El capítulo y el fragmento deben pertenecer al mismo proyecto.");
  });
});