import type {
  AuthorNote,
  DocumentRecord,
  KnowledgeEntity,
  SourceRecord,
  Tag,
  TagAssignment,
  TagTargetType,
  FragmentAnchor
} from "./model.js";

export type SearchItemType = TagTargetType;

export interface SearchResult {
  id: string;
  type: SearchItemType;
  title: string;
  excerpt: string;
  tags: string[];
  score: number;
  anchor?: Pick<FragmentAnchor, "documentId" | "quote" | "prefix" | "suffix">;
}

export interface SearchInput {
  query: string;
  documents: DocumentRecord[];
  entities: KnowledgeEntity[];
  sources: SourceRecord[];
  notes: AuthorNote[];
  tags: Tag[];
  assignments: TagAssignment[];
}

export interface SearchIndex {
  entries: Array<Omit<SearchResult, "anchor"> & {
    normalizedTitle: string;
    normalizedContent: string;
    normalizedTags: string;
    passageTags: Array<{ tag: string; anchor: NonNullable<TagAssignment["anchor"]> }>;
  }>;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function excerptFor(text: string, term: string): string {
  const source = text.trim();
  if (!source) return "";
  const index = source.toLocaleLowerCase("es").indexOf(term.toLocaleLowerCase("es"));
  const start = index > 50 ? index - 50 : 0;
  const snippet = source.slice(start, start + 180).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${snippet}${start + 180 < source.length ? "…" : ""}`;
}

export function buildProjectSearchIndex(input: Omit<SearchInput, "query">): SearchIndex {
  const tagsByTarget = new Map<string, string[]>();
  const passageTagsByTarget = new Map<string, Array<{ tag: string; anchor: NonNullable<TagAssignment["anchor"]> }>>();
  const tagsById = new Map(input.tags.map((tag) => [tag.id, tag]));
  for (const assignment of input.assignments) {
    const tag = tagsById.get(assignment.tagId);
    if (!tag) continue;
    const key = `${assignment.targetType}:${assignment.targetId}`;
    tagsByTarget.set(key, [...(tagsByTarget.get(key) ?? []), tag.name]);
    if (assignment.anchor) {
      const passageTags = passageTagsByTarget.get(key) ?? [];
      const duplicate = passageTags.some((item) => item.tag === tag.name && item.anchor.documentId === assignment.anchor!.documentId && item.anchor.quote === assignment.anchor!.quote && item.anchor.prefix === assignment.anchor!.prefix && item.anchor.suffix === assignment.anchor!.suffix);
      if (!duplicate) passageTagsByTarget.set(key, [...passageTags, { tag: tag.name, anchor: assignment.anchor }]);
    }
  }

  const candidates: Array<{ id: string; type: SearchItemType; title: string; text: string }> = [
    ...input.documents.map((item) => ({ id: item.id, type: "document" as const, title: item.title, text: item.text })),
    ...input.entities.map((item) => ({
      id: item.id, type: "entity" as const, title: item.title,
      text: [item.description, ...(item.details ?? []).flatMap((detail) => [detail.label, detail.value]), ...(item.externalLinks ?? []).flatMap((link) => [link.label, link.url])].filter(Boolean).join(" ")
    })),
    ...input.sources.map((item) => ({
      id: item.id, type: "source" as const, title: item.title,
      text: [item.author, item.publisher, item.year, item.doi, item.url, item.citation].filter(Boolean).join(" ")
    })),
    ...input.notes.map((item) => ({ id: item.id, type: "author_note" as const, title: item.content.split("\n")[0] || "Nota del autor", text: item.content }))
  ];

  const entries = candidates.map((item) => {
    const itemTags = tagsByTarget.get(`${item.type}:${item.id}`) ?? [];
    const normalizedTitle = fold(item.title);
    const normalizedTags = fold(itemTags.join(" "));
    const normalizedContent = fold(`${item.title} ${item.text} ${itemTags.join(" ")}`);
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      excerpt: item.text,
      tags: itemTags,
      score: 0,
      normalizedTitle,
      normalizedContent,
      normalizedTags,
      passageTags: passageTagsByTarget.get(`${item.type}:${item.id}`) ?? []
    };
  });
  return { entries };
}

export function searchIndexedProject(index: SearchIndex, query: string): SearchResult[] {
  const terms = [...new Set(fold(query).trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  return index.entries.flatMap((item) => {
    const { normalizedTitle: title, normalizedContent: content, normalizedTags: tagsText } = item;
    if (!terms.every((term) => content.includes(term))) return [];
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 4 : tagsText.includes(term) ? 3 : 1), 0);
    const matchedTerm = terms.find((term) => fold(item.excerpt).includes(term)) ?? terms[0]!;
    const base = fold(`${item.title} ${item.excerpt}`);
    const anchoredMatches = item.passageTags.filter((passage) => {
      const passageTag = fold(passage.tag);
      return terms.some((term) => passageTag.includes(term)) &&
        terms.every((term) => base.includes(term) || passageTag.includes(term));
    });
    if (anchoredMatches.length) {
      return anchoredMatches.map((passage) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        excerpt: `«${passage.anchor.quote}»`,
        tags: [passage.tag],
        score: score + 1,
        anchor: passage.anchor
      }));
    }
    return [{ id: item.id, type: item.type, title: item.title, excerpt: excerptFor(item.excerpt || item.title, matchedTerm), tags: item.tags, score }];
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"));
}

export function searchProject(input: SearchInput): SearchResult[] {
  return searchIndexedProject(buildProjectSearchIndex(input), input.query);
}
