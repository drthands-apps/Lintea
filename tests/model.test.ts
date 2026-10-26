import { describe, expect, it } from "vitest";
import { createRelation } from "../src/core/model.js";

describe("relaciones", () => {
  it("crea una relación con identificador y fecha", () => {
    const relation = createRelation(
      {
        projectId: "project-1",
        fromId: "fragment-1",
        fromType: "fragment",
        toId: "entity-1",
        toType: "entity",
        kind: "mentions"
      },
      () => new Date("2026-01-02T03:04:05.000Z")
    );

    expect(relation.id).toBeTruthy();
    expect(relation.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(relation.kind).toBe("mentions");
  });

  it("rechaza una relación sin identificadores", () => {
    expect(() => createRelation({
      projectId: "project-1",
      fromId: " ",
      fromType: "fragment",
      toId: "entity-1",
      toType: "entity",
      kind: "mentions"
    })).toThrow();
  });

  it("rechaza una relación de un elemento consigo mismo", () => {
    expect(() => createRelation({
      projectId: "project-1",
      fromId: "same",
      fromType: "entity",
      toId: "same",
      toType: "entity",
      kind: "related_to"
    })).toThrow();
  });
});
