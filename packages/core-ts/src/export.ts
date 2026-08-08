import type { ParamValues, Term } from "./types.js";

function fill(template: string, values: ParamValues): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

function fillDeep(obj: unknown, values: ParamValues): unknown {
  if (typeof obj === "string") return fill(obj, values);
  if (Array.isArray(obj)) return obj.map((x) => fillDeep(x, values));
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = fillDeep(v, values);
    return out;
  }
  return obj;
}

export function exportEqualizerApo(term: Term, values: ParamValues): string | null {
  if (!term.exports.equalizerApo) return null;
  return fill(term.exports.equalizerApo, values);
}

export function exportObs(term: Term, values: ParamValues): Record<string, unknown> | null {
  if (!term.exports.obs) return null;
  return fillDeep(term.exports.obs, values) as Record<string, unknown>;
}

export function exportBundle(term: Term, values: ParamValues): {
  equalizerApo: string | null;
  obs: Record<string, unknown> | null;
  conceptualOnly: boolean;
} {
  const equalizerApo = exportEqualizerApo(term, values);
  const obs = exportObs(term, values);
  return {
    equalizerApo,
    obs,
    conceptualOnly: !equalizerApo && !obs,
  };
}
