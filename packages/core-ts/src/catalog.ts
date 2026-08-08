import type { Lexicon, ParamValues, Term, TreeNode } from "./types.js";

export function parseLexicon(data: unknown): Lexicon {
  if (!data || typeof data !== "object") throw new Error("lexicon must be an object");
  const lex = data as Lexicon;
  if (!lex.version || !Array.isArray(lex.tree) || !lex.terms || !Array.isArray(lex.samples)) {
    throw new Error("lexicon missing required fields");
  }
  return lex;
}

export function defaultParams(term: Term): ParamValues {
  const values: ParamValues = {};
  for (const p of term.parameters) values[p.id] = p.default;
  return values;
}

export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function filterTree(nodes: TreeNode[], query: string, terms: Record<string, Term>): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const matchTerm = (termId: string | undefined) => {
    if (!termId) return false;
    const t = terms[termId];
    if (!t) return false;
    const hay = [t.name, t.summary, ...(t.aliases ?? []), t.plainMeaning].join(" ").toLowerCase();
    return hay.includes(q);
  };

  const filterNodes = (list: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const n of list) {
      if (n.termId && matchTerm(n.termId)) {
        result.push({ ...n, children: undefined });
        continue;
      }
      if (n.children) {
        const kids = filterNodes(n.children);
        if (kids.length || n.label.toLowerCase().includes(q)) {
          result.push({ ...n, children: kids });
        }
      } else if (n.label.toLowerCase().includes(q)) {
        result.push(n);
      }
    }
    return result;
  };

  return filterNodes(nodes);
}

export function searchTerms(lex: Lexicon, query: string): Term[] {
  const q = query.trim().toLowerCase();
  if (!q) return Object.values(lex.terms);
  return Object.values(lex.terms).filter((t) => {
    const hay = [t.name, t.summary, ...(t.aliases ?? []), t.category].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
