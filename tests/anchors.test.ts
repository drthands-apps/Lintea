import { describe, expect, it } from "vitest";
import { createFragmentAnchor, resolveFragmentAnchor } from "../src/core/anchors.js";

describe("anclajes de fragmentos", () => {
  it("crea un anclaje con texto y contexto", () => {
    const text = "Mara llegó al puerto antes del amanecer.";
    const start = text.indexOf("llegó al puerto");
    const anchor = createFragmentAnchor("doc-1", "frag-1", text, start, start + "llegó al puerto".length);

    expect(anchor.quote).toBe("llegó al puerto");
    expect(anchor.documentId).toBe("doc-1");
    expect(anchor.fragmentId).toBe("frag-1");
  });

  it("localiza el fragmento si se añade texto antes", () => {
    const original = "Mara llegó al puerto antes del amanecer.";
    const start = original.indexOf("llegó al puerto");
    const anchor = createFragmentAnchor("doc-1", "frag-1", original, start, start + "llegó al puerto".length);

    const edited = "Capítulo nuevo. Una noche fría. " + original;
    const result = resolveFragmentAnchor(anchor, edited);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(edited.slice(result.start, result.end)).toBe("llegó al puerto");
      expect(result.start).toBeGreaterThan(start);
    }
  });

  it("pide revisión si el texto anclado ha desaparecido", () => {
    const original = "Mara llegó al puerto antes del amanecer.";
    const start = original.indexOf("llegó al puerto");
    const anchor = createFragmentAnchor("doc-1", "frag-1", original, start, start + "llegó al puerto".length);

    const result = resolveFragmentAnchor(anchor, "Mara observó el puerto antes del amanecer.");
    expect(result).toEqual({ status: "needs-review", reason: "quote-not-found", candidates: [] });
  });

  it("pide revisión cuando hay duplicados sin contexto suficiente", () => {
    const original = "inicio palabra final";
    const start = original.indexOf("palabra");
    const anchor = createFragmentAnchor("doc-1", "frag-1", original, start, start + "palabra".length, 0);

    const result = resolveFragmentAnchor(anchor, "palabra y palabra");
    expect(result.status).toBe("needs-review");
    if (result.status === "needs-review") {
      expect(result.reason).toBe("ambiguous");
      expect(result.candidates).toEqual([0, 10]);
    }
  });

  it("rechaza una selección inválida", () => {
    expect(() => createFragmentAnchor("doc-1", "frag-1", "texto", 4, 2)).toThrow();
  });
});
