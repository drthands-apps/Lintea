
import { describe, expect, it } from "vitest";
import { createTestService } from "./helpers.js";

describe("notas del autor", () => {
  it("crea una nota asociada al proyecto completo", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const note = await service.createAuthorNote({ projectId: project.id, content: "  idea  " });
    expect(note.content).toBe("idea");
    expect(note.targetType).toBeUndefined();
    expect(note.targetId).toBeUndefined();
    expect(note.color).toBe("sand");
    expect(await service.listAuthorNotes(project.id)).toEqual([note]);
  });

  it("crea notas vinculadas a documento, fragmento, ficha y fuente", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const fragment = await service.createDocument({ projectId: project.id, title: "F", kind: "fragment" });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "E" });
    const source = await service.createSource({ projectId: project.id, title: "S" });

    const targets = [
      { targetType: "document" as const, targetId: doc.id },
      { targetType: "fragment" as const, targetId: fragment.id },
      { targetType: "entity" as const, targetId: entity.id },
      { targetType: "source" as const, targetId: source.id }
    ];

    for (const target of targets) {
      const note = await service.createAuthorNote({ projectId: project.id, content: "n", ...target });
      expect(note.targetType).toBe(target.targetType);
      expect(note.targetId).toBe(target.targetId);
    }

    expect(await service.listAuthorNotes(project.id)).toHaveLength(4);
  });

  it("rechaza una nota vacía", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    await expect(
      service.createAuthorNote({ projectId: project.id, content: "   " })
    ).rejects.toThrow("La nota no puede estar vacía.");
  });

  it("rechaza un proyecto inexistente", async () => {
    const { service } = createTestService();
    await expect(
      service.createAuthorNote({ projectId: "no-existe", content: "n" })
    ).rejects.toThrow("El proyecto de la nota no existe.");
  });

  it("rechaza vincular una nota a un fragmento que no es fragmento", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const chapter = await service.createDocument({ projectId: project.id, title: "C", kind: "chapter" });
    await expect(
      service.createAuthorNote({
        projectId: project.id, content: "n", targetType: "fragment", targetId: chapter.id
      })
    ).rejects.toThrow("La nota y su elemento asociado deben pertenecer al mismo proyecto.");
  });

  it("rechaza vincular una nota a un elemento de otro proyecto", async () => {
    const { service } = createTestService();
    const a = await service.createProject({ title: "A" });
    const b = await service.createProject({ title: "B" });
    const foreign = await service.createDocument({ projectId: b.id, title: "DB" });
    await expect(
      service.createAuthorNote({
        projectId: a.id, content: "n", targetType: "document", targetId: foreign.id
      })
    ).rejects.toThrow("La nota y su elemento asociado deben pertenecer al mismo proyecto.");
  });

  it("reasigna una nota sin cambiar su identidad", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const entity = await service.createKnowledgeEntity({ projectId: project.id, kind: "concept", title: "E" });
    const note = await service.createAuthorNote({
      projectId: project.id, content: "n", targetType: "document", targetId: doc.id
    });
    const updated = await service.updateAuthorNote({
      ...note, targetType: "entity", targetId: entity.id
    });
    expect(updated.id).toBe(note.id);
    expect(updated.targetType).toBe("entity");
    expect(updated.targetId).toBe(entity.id);
    expect(updated.updatedAt).not.toBe(note.updatedAt);
  });

  it("no actualiza la fecha si la nota no cambia", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const note = await service.createAuthorNote({ projectId: project.id, content: "n" });
    const result = await service.updateAuthorNote(note);
    expect(result.updatedAt).toBe(note.updatedAt);
  });

  it("eliminar una nota no elimina el elemento asociado", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const doc = await service.createDocument({ projectId: project.id, title: "D" });
    const note = await service.createAuthorNote({
      projectId: project.id, content: "n", targetType: "document", targetId: doc.id
    });
    await service.deleteAuthorNote(project.id, note.id);
    expect(await service.listAuthorNotes(project.id)).toHaveLength(0);
    expect((await service.listDocuments(project.id)).map((d) => d.id)).toContain(doc.id);
  });

  it("asigna un order al final", async () => {
    const { service } = createTestService();
    const project = await service.createProject({ title: "P" });
    const first = await service.createAuthorNote({ projectId: project.id, content: "primera" });
    const second = await service.createAuthorNote({ projectId: project.id, content: "segunda" });
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });
});