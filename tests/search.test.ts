
import { describe, expect, it } from "vitest";
import {
  buildProjectSearchIndex,
  searchIndexedProject,
  searchProject
} from "../src/core/search.js";
import type {
  AuthorNote,
  DocumentRecord,
  KnowledgeEntity,
  SourceRecord,
  Tag,
  TagAssignment
} from "../src/core/model.js";



function assignment(
  tagId: string,
  targetId: string,
  anchor?: NonNullable<TagAssignment["anchor"]>
): TagAssignment {
  return {
    projectId: "p",
    tagId,
    targetType: "document",
    targetId,
    ...(anchor ? { anchor } : {})
  };
}

const base = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function doc(id: string, title: string, text = ""): DocumentRecord {
  return { ...base, id, projectId: "p", title, text };
}
function entity(id: string, title: string, extra: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return { id, projectId: "p", kind: "concept", title, ...extra };
}
function source(id: string, title: string, extra: Partial<SourceRecord> = {}): SourceRecord {
  return { id, projectId: "p", title, ...extra };
}
function note(id: string, content: string): AuthorNote {
  return { ...base, id, projectId: "p", content, color: "sand" };
}
function tag(id: string, name: string): Tag {
  return { id, projectId: "p", name, normalizedName: name.toLowerCase(), createdAt: base.createdAt };
}

function emptyInput() {
  return {
    documents: [] as DocumentRecord[],
    entities: [] as KnowledgeEntity[],
    sources: [] as SourceRecord[],
    notes: [] as AuthorNote[],
    tags: [] as Tag[],
    assignments: [] as TagAssignment[]
  };
}

describe("búsqueda del proyecto", () => {
  it("encuentra sin distinguir mayúsculas ni acentos", () => {
    const input = {
      ...emptyInput(),
      documents: [doc("d1", "El puerto", "Mara llegó al amanecer.")]
    };
    expect(searchProject({ ...input, query: "MARA" }).map((r) => r.id)).toEqual(["d1"]);
    expect(searchProject({ ...input, query: "amanecer" }).map((r) => r.id)).toEqual(["d1"]);
    expect(searchProject({ ...input, query: "puérto" }).map((r) => r.id)).toEqual(["d1"]);
  });

  it("exige que aparezcan todos los términos", () => {
    const input = {
      ...emptyInput(),
      documents: [doc("d1", "Mara", "llegó al amanecer.")]
    };
    expect(searchProject({ ...input, query: "mara amanecer" }).map((r) => r.id)).toEqual(["d1"]);
    expect(searchProject({ ...input, query: "mara puerto" })).toEqual([]);
  });

  it("prioriza coincidencia en título sobre contenido", () => {
    const input = {
      ...emptyInput(),
      documents: [
        doc("en-titulo", "Mara", ""),
        doc("en-texto", "Otra", "Mara caminaba.")
      ]
    };
    const results = searchProject({ ...input, query: "mara" });
    expect(results[0]!.id).toBe("en-titulo");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("encuentra coincidencias en fichas (descripción, detalles y enlaces)", () => {
    const input = {
      ...emptyInput(),
      entities: [
        entity("e1", "Mara", {
          description: "Navegante.",
          details: [{ label: "Origen", value: "Puerto del norte" }],
          externalLinks: [{ label: "Ficha", url: "https://ejemplo.test/mara" }]
        })
      ]
    };
    expect(searchProject({ ...input, query: "navegante" }).map((r) => r.id)).toEqual(["e1"]);
    expect(searchProject({ ...input, query: "puerto" }).map((r) => r.id)).toEqual(["e1"]);
    expect(searchProject({ ...input, query: "ejemplo" }).map((r) => r.id)).toEqual(["e1"]);
  });

  it("encuentra coincidencias en fuentes (autor, editorial, año, DOI, URL y cita)", () => {
    const input = {
      ...emptyInput(),
      sources: [
        source("s1", "Historia del puerto", {
          author: "Ana Ruiz", publisher: "Ediciones Mar", year: "1998",
          doi: "10.0000/xyz", url: "https://ejemplo.test/fuente", citation: "Capítulo 4"
        })
      ]
    };
    for (const q of ["ana", "mar", "1998", "xyz", "ejemplo", "capítulo"]) {
      expect(searchProject({ ...input, query: q }).map((r) => r.id)).toEqual(["s1"]);
    }
  });

  it("encuentra coincidencias en notas del autor", () => {
    const input = { ...emptyInput(), notes: [note("n1", "Recordar revisar el final.")] };
    expect(searchProject({ ...input, query: "revisar" }).map((r) => r.id)).toEqual(["n1"]);
  });

  it("incluye etiquetas generales en la búsqueda", () => {
    const t = tag("t1", "investigar");
    const input = {
      ...emptyInput(),
      documents: [doc("d1", "Notas", "texto")],
      tags: [t],
      assignments: [assignment(t.id, "d1")]
    };
    expect(searchProject({ ...input, query: "investigar" }).map((r) => r.id)).toEqual(["d1"]);
  });

 it("devuelve un resultado por cada pasaje etiquetado distinto del mismo documento", () => {
  const t = tag("t1", "investigar");
  const a1 = { documentId: "d1", quote: "uno", prefix: "", suffix: "" };
  const a2 = { documentId: "d1", quote: "dos", prefix: "", suffix: "" };
  const input = {
    ...emptyInput(),
    documents: [doc("d1", "Notas", "Sin coincidencia literal.")],
    tags: [t],
    assignments: [
      assignment(t.id, "d1", a1),
      assignment(t.id, "d1", a2)
    ]
  };
  const results = searchProject({ ...input, query: "investigar" });
  expect(results).toHaveLength(2);
  expect(results.map((r) => r.anchor?.quote).sort()).toEqual(["dos", "uno"]);
});

  it("devuelve un resultado por cada pasaje etiquetado distinto del mismo documento", () => {
    const t = tag("t1", "investigar");
    const a1 = { documentId: "d1", quote: "uno", prefix: "", suffix: "" };
    const a2 = { documentId: "d1", quote: "dos", prefix: "", suffix: "" };
    const input = {
      ...emptyInput(),
      documents: [doc("d1", "Notas", "Sin coincidencia literal.")],
      tags: [t],
      assignments: [
        assignment(t.id, "d1",a1),
        assignment(t.id, "d1",a2)
      ]
    };
    const results = searchProject({ ...input, query: "investigar" });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.anchor?.quote).sort()).toEqual(["dos", "uno"]);
  });

  it("no duplica resultados cuando hay varias asignaciones idénticas de la misma etiqueta al mismo anclaje", () => {
    const t = tag("t1", "investigar");
    const anchor = { documentId: "d1", quote: "x", prefix: "", suffix: "" };
    const input = {
      ...emptyInput(),
      documents: [doc("d1", "Notas", "Sin coincidencia literal.")],
      tags: [t],
      assignments: [
        assignment(t.id, "d1", anchor),
        assignment(t.id, "d1", anchor)
      ]
    };
    expect(searchProject({ ...input, query: "investigar" })).toHaveLength(1);
  });

  it("sin consulta no devuelve resultados", () => {
    const input = { ...emptyInput(), documents: [doc("d1", "Mara", "texto")] };
    expect(searchProject({ ...input, query: "   " })).toEqual([]);
  });

  it("reutiliza el índice construido", () => {
    const input = { ...emptyInput(), documents: [doc("d1", "Mara", "texto")] };
    const index = buildProjectSearchIndex(input);
    expect(searchIndexedProject(index, "mara").map((r) => r.id)).toEqual(["d1"]);
    expect(searchIndexedProject(index, "otro")).toEqual([]);
  });
});