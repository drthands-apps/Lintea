import type { FragmentAnchor } from "./model.js";

export type AnchorResolution =
  | { status: "resolved"; start: number; end: number; confidence: "high" | "medium" }
  | { status: "needs-review"; reason: "quote-not-found" | "ambiguous"; candidates: number[] };

/**
 * Creates a text anchor around a selection in a document.
 * start/end are offsets in the current document; the stored anchor itself
 * relies on the selected text plus nearby context, not offsets alone.
 */
export function createFragmentAnchor(
  documentId: string,
  fragmentId: string,
  documentText: string,
  start: number,
  end: number,
  contextLength = 32
): FragmentAnchor {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > documentText.length) {
    throw new Error("La selección del fragmento no es válida.");
  }

  const quote = documentText.slice(start, end);
  if (!quote.trim()) {
    throw new Error("El fragmento no puede estar vacío.");
  }

  return {
    documentId,
    fragmentId,
    quote,
    prefix: documentText.slice(Math.max(0, start - contextLength), start),
    suffix: documentText.slice(end, Math.min(documentText.length, end + contextLength))
  };
}

/**
 * Attempts to resolve an anchor against an edited document.
 *
 * Never chooses arbitrarily if multiple candidates remain. If the exact quote
 * occurs once, it resolves with high confidence. If it occurs multiple times,
 * nearby prefix/suffix context is used to disambiguate. Otherwise, manual review
 * is required rather than silently attaching the relation to the wrong text.
 */
export function resolveFragmentAnchor(
  anchor: Pick<FragmentAnchor, "documentId" | "quote" | "prefix" | "suffix">,
  currentText: string
): AnchorResolution {
  const candidates: number[] = [];
  let fromIndex = 0;

  while (fromIndex <= currentText.length - anchor.quote.length) {
    const foundAt = currentText.indexOf(anchor.quote, fromIndex);
    if (foundAt === -1) break;
    candidates.push(foundAt);
    fromIndex = foundAt + 1;
  }

  if (candidates.length === 0) {
    return { status: "needs-review", reason: "quote-not-found", candidates: [] };
  }

  if (candidates.length === 1) {
    const start = candidates[0]!;
    return { status: "resolved", start, end: start + anchor.quote.length, confidence: "high" };
  }

  const scored = candidates.map((start) => {
    const end = start + anchor.quote.length;
    const prefixMatch = commonSuffixLength(
      currentText.slice(Math.max(0, start - anchor.prefix.length), start),
      anchor.prefix
    );
    const suffixMatch = commonPrefixLength(
      currentText.slice(end, end + anchor.suffix.length),
      anchor.suffix
    );
    return { start, score: prefixMatch + suffixMatch };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const second = scored[1];

  // Context must match something, and the best candidate must beat the next.
  if (best.score > 0 && (!second || best.score > second.score)) {
    return {
      status: "resolved",
      start: best.start,
      end: best.start + anchor.quote.length,
      confidence: "medium"
    };
  }

  return {
    status: "needs-review",
    reason: "ambiguous",
    candidates
  };
}

function commonSuffixLength(a: string, b: string): number {
  let count = 0;
  while (count < a.length && count < b.length && a[a.length - 1 - count] === b[b.length - 1 - count]) {
    count++;
  }
  return count;
}

function commonPrefixLength(a: string, b: string): number {
  let count = 0;
  while (count < a.length && count < b.length && a[count] === b[count]) {
    count++;
  }
  return count;
}
