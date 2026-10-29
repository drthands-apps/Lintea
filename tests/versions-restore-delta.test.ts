import { describe, expect, it } from "vitest";
import { createTestService } from "./helpers.js";

describe("restauración de versiones con relaciones", () => {
  it("restaurar una versión antigua escribe su contenido en el documento actual", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });

    await service.restoreDocumentVersion(document.id, first.id);
    const restored = await service.getDocument(document.id);
    expect(restored?.text).toBe("Estado A.");
  });

  it("restaurar crea una relación 'restaurado desde X'", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const first = await service.saveDocumentVersion(document.id);

    await service.updateDocument(document.id, { title: "Borrador", text: "Estado B." });
    const second = await service.saveDocumentVersion(document.id);

    await service.restoreDocumentVersion(document.id, first.id);
    const relations = await service.listVersionRelations(document.id);

    // Debe existir una relación cuyo toStateId apunte a first.id
    // (el estado restaurado) y cuyo label mencione "Restaurado".
    const restoreRelation = relations.find((r) => r.toStateId === first.id);
    expect(restoreRelation).toBeDefined();
    expect(restoreRelation!.label).toMatch(/Restaurado/i);
    // Y el estado del que se viene es second.
    expect(restoreRelation!.fromStateId).toBe(second.id);
  });

  it("restaurar no elimina relaciones nuevas del proyecto", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const document = await service.createDocument({
      projectId: project.id, title: "Borrador", text: "Estado A."
    });
    const entityOld = await service.createKnowledgeEntity({
      projectId: project.id, kind: "concept", title: "Vieja"
    });
    const relationOld = await service.createRelation({
      projectId: project.id,
      fromId: document.id, fromType: "document",
      toId: entityOld.id, toType: "entity",
      kind: "mentions"
    });
    const version = await service.saveDocumentVersion(document.id);

    const entityNew = await service.createKnowledgeEntity({
      projectId: project.id, kind: "concept", title: "Nueva"
    });
    const relationNew = await service.createRelation({
      projectId: project.id,
      fromId: document.id, fromType: "document",
      toId: entityNew.id, toType: "entity",
      kind: "mentions"
    });

    await service.restoreDocumentVersion(document.id, version.id);

    const relations = await service.listRelations(project.id);
    expect(relations.map((r) => r.id).sort()).toEqual(
      [relationOld.id, relationNew.id].sort()
    );
  });
});