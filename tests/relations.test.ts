
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

describe("relaciones del servicio", () => {
  it("crea una relación con anclaje válido dentro del documento", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D", text: "Mara llegó al puerto." });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "character", title: "Mara" });
    const anchor = { documentId: doc.id, quote: "Mara", prefix: "", suffix: " llegó al puerto." };
    const relation = await service.createRelation({
      projectId: project.id, fromId: doc.id, fromType: "document",
      toId: entity.id, toType: "entity", kind: "mentions", anchor
    });
    expect(relation.anchor?.quote).toBe("Mara");
  });

  it("rechaza un anclaje que no pertenece a los extremos", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D", text: "x" });
    const other = await service.createDocument({ projectId: project.id, title: "O", text: "y" });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "E" });
    await expect(service.createRelation({
      projectId: project.id, fromId: doc.id, fromType: "document",
      toId: entity.id, toType: "entity", kind: "mentions",
      anchor: { documentId: other.id, quote: "y", prefix: "", suffix: "" }
    })).rejects.toThrow("El pasaje anclado debe pertenecer a uno de los documentos de la relación.");
  });

  it("normaliza el tipo event a entity al crear la relación", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const event = await service.createKnowledgeEntity({ projectId: project.id, kind: "event", title: "Batalla" });
    const relation = await service.createRelation({
      projectId: project.id, fromId: doc.id, fromType: "document",
      toId: event.id, toType: "event", kind: "mentions"
    });
    expect(relation.toType).toBe("entity");
  });

  it("al cambiar el kind de una ficha normaliza relaciones y notas event", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const event = await service.createKnowledgeEntity({ projectId: project.id, kind: "event", title: "Evento" });
    await service.createRelation({
      projectId: project.id, fromId: doc.id, fromType: "document",
      toId: event.id, toType: "event", kind: "mentions"
    });
    const note = await service.createAuthorNote({
      projectId: project.id, content: "nota", targetType: "event", targetId: event.id
    });
    await service.updateKnowledgeEntity({ ...event, kind: "concept" });
    const relations = await service.listRelations(project.id);
    const notes = await service.listAuthorNotes(project.id);
    expect(relations.find((r) => r.id === relations[0]!.id)?.toType).toBe("entity");
    expect(notes.find((n) => n.id === note.id)?.targetType).toBe("entity");
  });

  it("actualiza la nota de una relación y la borra sin afectar a otras", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const a = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "A" });
    const b = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "B" });
    const r1 = await service.createRelation({ projectId: project.id, fromId: doc.id, fromType: "document", toId: a.id, toType: "entity", kind: "mentions" });
    const r2 = await service.createRelation({ projectId: project.id, fromId: doc.id, fromType: "document", toId: b.id, toType: "entity", kind: "mentions" });
    const updated = await service.updateRelationNote(project.id, r1.id, "  explica  ");
    expect(updated.note).toBe("explica");
    await service.deleteRelation(project.id, r1.id);
    expect((await service.listRelations(project.id)).map((r) => r.id)).toEqual([r2.id]);
  });

  it("eliminar una ficha borra sus relaciones y desvincula sus notas", async () => {
    const { service } = createService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "E" });
    await service.createRelation({ projectId: project.id, fromId: doc.id, fromType: "document", toId: entity.id, toType: "entity", kind: "mentions" });
    const note = await service.createAuthorNote({ projectId: project.id, content: "n", targetType: "entity", targetId: entity.id });
    await service.deleteKnowledgeEntity(project.id, entity.id);
    expect(await service.listRelations(project.id)).toHaveLength(0);
    const notes = await service.listAuthorNotes(project.id);
    const stored = notes.find((n) => n.id === note.id);
    expect(stored?.targetType).toBeUndefined();
    expect(stored?.targetId).toBeUndefined();
  });

  it("rechaza relaciones entre elementos de proyectos distintos", async () => {
    const { service } = createService();
    const a = await service.createProject({ title: "A" });
    const b = await service.createProject({ title: "B" });
    const docA = await service.createDocument({ projectId: a.id, title: "DA" });
    const entityB = await service.createKnowledgeEntity({ projectId: b.id, kind: "concept", title: "EB" });
    await expect(service.createRelation({
      projectId: a.id, fromId: docA.id, fromType: "document",
      toId: entityB.id, toType: "entity", kind: "mentions"
    })).rejects.toThrow("Los elementos de una relación deben existir en el mismo proyecto.");
  });
});