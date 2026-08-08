import type { Term } from "./types.js";

/** Catalog homepage entry shown at the top of the filter tree. */
export const HOME_TERM_ID = "home";

export function isHomeTerm(term: Term | undefined | null): boolean {
  return !!term && (term.id === HOME_TERM_ID || term.category === "home");
}

export function defaultSelectedTermId(termIds: Iterable<string>): string {
  const ids = new Set(termIds);
  if (ids.has(HOME_TERM_ID)) return HOME_TERM_ID;
  if (ids.has("peaking-eq")) return "peaking-eq";
  const first = ids.values().next();
  return first.done ? HOME_TERM_ID : first.value;
}
