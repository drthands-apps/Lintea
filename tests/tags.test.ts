
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

describe("etiquetas", () => {
  it("crea etiquetas con nombre normalizado y rechaza duplicados", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const tag = await service.createTag(project.id, "  Borrador  ");
    expect(tag.name).toBe("Borrador");
    expect(tag.normalizedName).toBe("borrador");
    await expect(service.createTag(project.id, "BORRADOR")).rejects.toThrow(
      "Ya existe una etiqueta con ese nombre en este proyecto."
    );
  });

  it("renombra conservando asignaciones y rechaza nombres duplicados", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const tag = await service.createTag(project.id, "uno");
    const other = await service.createTag(project.id, "dos");
    await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: doc.id }, true);
    await service.updateTag(project.id, tag.id, "primero");
    const assignments = await service.listTagAssignments(project.id);
    expect(assignments.find((a) => a.tagId === tag.id)?.targetId).toBe(doc.id);
    await expect(service.updateTag(project.id, tag.id, other.name)).rejects.toThrow();
  });

  it("eliminar una etiqueta retira asignaciones pero no elementos", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const tag = await service.createTag(project.id, "efímera");
    await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: doc.id }, true);
    await service.deleteTag(project.id, tag.id);
    expect(await service.listTagAssignments(project.id)).toHaveLength(0);
    expect((await service.listDocuments(project.id)).map((d) => d.id)).toContain(doc.id);
  });

  it("asigna etiquetas a documento, ficha, fuente y nota", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "E" });
    const source = await service.createSource({ projectId: project.id, title: "S" });
    const note = await service.createAuthorNote({ projectId: project.id, content: "N" });
    const tag = await service.createTag(project.id, "común");
    for (const [targetType, targetId] of [["document", doc.id], ["entity", entity.id], ["source", source.id], ["author_note", note.id]] as const) {
      await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType, targetId }, true);
    }
    expect(await service.listTagAssignments(project.id)).toHaveLength(4);
  });

  it("registra un anclaje de pasaje solo en documentos y rechaza anclajes ajenos", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D", text: "Mara llegó al puerto." });
    const other = await service.createDocument({ projectId: project.id, title: "O", text: "Otro texto." });
    const tag = await service.createTag(project.id, "pasaje");
    const anchor = { documentId: doc.id, quote: "llegó", prefix: "Mara ", suffix: " al puerto." };
    await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: doc.id, anchor }, true);
    const assignments = await service.listTagAssignments(project.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.anchor?.quote).toBe("llegó");
    await expect(
      service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: other.id, anchor }, true)
    ).rejects.toThrow("El pasaje etiquetado debe pertenecer al documento seleccionado.");
    await expect(
      service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "entity", targetId: "x", anchor }, true)
    ).rejects.toThrow();
  });

  it("quitar una asignación no afecta a otras asignaciones de la misma etiqueta", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const tag = await service.createTag(project.id, "x");
    await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: doc.id }, true);
    await service.setTagAssignment({ projectId: project.id, tagId: tag.id, targetType: "document", targetId: doc.id }, false);
    expect(await service.listTagAssignments(project.id)).toHaveLength(0);
  });

  it("rechaza asignar una etiqueta de otro proyecto", async () => {
    const { service } = createService();
    const a = await service.createProject({ title: "A" });
    const b = await service.createProject({ title: "B" });
    const docB = await service.createDocument({ projectId: b.id, title: "DB" });
    const tagA = await service.createTag(a.id, "etiqueta A");
    await expect(
      service.setTagAssignment({ projectId: b.id, tagId: tagA.id, targetType: "document", targetId: docB.id }, true)
    ).rejects.toThrow("La etiqueta no pertenece a este proyecto.");
  });
});