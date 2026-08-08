import lexiconJson from "./data/lexicon.json";
import {
  createAuditionGraph,
  decodeAudioUrl,
  defaultParams,
  defaultSelectedTermId,
  parseLexicon,
  type AuditionGraph,
  type Lexicon,
} from "@hci-nerdz/core-ts";
import { paintLive, paintTree, render, type UiState } from "./ui/render.js";
import { effectiveTheme, initTheme, isThemeOverridden, toggleTheme } from "./theme.js";
import "./styles.css";
import versionJson from "./data/version.json";

const version = versionJson as { version: string; channel: string; name?: string };

const lex: Lexicon = parseLexicon(lexiconJson);
const fallbackTerm = defaultSelectedTermId(Object.keys(lex.terms));

function termFromLocation(): string {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("term");
  if (fromQuery && lex.terms[fromQuery]) return fromQuery;
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash && lex.terms[hash]) return hash;
  return fallbackTerm;
}

function syncUrl(termId: string, mode: "push" | "replace" = "push") {
  const url = new URL(location.href);
  if (lex.terms[termId]) url.searchParams.set("term", termId);
  else url.searchParams.delete("term");
  url.hash = "";
  const next = `${url.pathname}${url.search}${url.hash}`;
  const cur = `${location.pathname}${location.search}${location.hash}`;
  if (next === cur) return;
  if (mode === "replace") history.replaceState({ termId }, "", next);
  else history.pushState({ termId }, "", next);
}

const initialTerm = termFromLocation();

function syncThemeState() {
  state.theme = effectiveTheme();
  state.themeSource = isThemeOverridden() ? "manual" : "system";
}

const state: UiState = {
  lex,
  query: "",
  selectedId: initialTerm,
  values: defaultParams(lex.terms[initialTerm]),
  playing: false,
  bypass: false,
  sampleId: lex.samples.find((s) => s.path)?.id ?? "",
  showSamples: false,
  showAbout: false,
  status: "Idle",
  theme: "light",
  themeSource: "system",
};

const app = document.querySelector<HTMLElement>("#app")!;
let graph: AuditionGraph | null = null;
let bufferCache = new Map<string, AudioBuffer>();
let sampleSwapToken = 0;

function sampleUrl(id: string): string | null {
  const s = lex.samples.find((x) => x.id === id);
  if (!s?.path) return null;
  const name = s.path.split("/").pop();
  return `${import.meta.env.BASE_URL}samples/${name}`;
}

async function ensureGraph() {
  if (!graph) {
    const ctx = new AudioContext();
    graph = createAuditionGraph(ctx);
    graph.output.connect(ctx.destination);
  }
  if (graph.ctx.state === "suspended") await graph.ctx.resume();
  return graph;
}

async function loadSample(id: string) {
  const url = sampleUrl(id);
  if (!url) throw new Error("Sample has no local path");
  const g = await ensureGraph();
  let buf = bufferCache.get(id);
  if (!buf) {
    buf = await decodeAudioUrl(g.ctx, url);
    bufferCache.set(id, buf);
  }
  return buf;
}

function applyEffect() {
  if (!graph) return;
  const term = lex.terms[state.selectedId];
  if (!term) return;
  graph.apply(term.audition, state.values);
  graph.setBypass(state.bypass);
}

function paint() {
  render(app, state);
}

function paintStatus() {
  const el = app.querySelector<HTMLElement>("[data-status]");
  if (el) el.textContent = state.status;
}

function selectTerm(termId: string, historyMode: "push" | "replace" | false = "push") {
  if (!lex.terms[termId]) return;
  if (termId === state.selectedId) {
    if (historyMode) syncUrl(termId, historyMode);
    return;
  }
  state.selectedId = termId;
  state.values = defaultParams(lex.terms[termId]);
  applyEffect();
  if (historyMode) syncUrl(termId, historyMode);
  paint();
}

async function startPlayback() {
  const g = await ensureGraph();
  const buf = await loadSample(state.sampleId);
  applyEffect();
  g.playBuffer(buf, true);
  state.playing = true;
  state.status = `Playing · ${lex.samples.find((s) => s.id === state.sampleId)?.attribution ?? ""}`;
}

async function togglePlay() {
  if (state.playing) {
    graph?.stop();
    state.playing = false;
    state.status = "Stopped";
    paint();
    return;
  }
  try {
    await startPlayback();
  } catch (e) {
    state.playing = false;
    state.status = `Audition error: ${e instanceof Error ? e.message : String(e)}`;
  }
  paint();
}

/** Swap the audition buffer without rebuilding the UI (keeps the sample select focused). */
async function hotSwapSample(sampleId: string) {
  const token = ++sampleSwapToken;
  state.sampleId = sampleId;
  if (!state.playing) {
    state.status = `Selected · ${lex.samples.find((s) => s.id === sampleId)?.title ?? sampleId}`;
    paintStatus();
    return;
  }
  try {
    state.status = "Loading sample…";
    paintStatus();
    const buf = await loadSample(sampleId);
    if (token !== sampleSwapToken) return;
    const g = await ensureGraph();
    if (token !== sampleSwapToken) return;
    applyEffect();
    g.playBuffer(buf, true);
    state.playing = true;
    state.status = `Playing · ${lex.samples.find((s) => s.id === sampleId)?.attribution ?? ""}`;
    paintStatus();
  } catch (e) {
    if (token !== sampleSwapToken) return;
    state.status = `Audition error: ${e instanceof Error ? e.message : String(e)}`;
    paintStatus();
  }
}

app.addEventListener("click", async (ev) => {
  const t = ev.target as HTMLElement;
  const termBtn = t.closest<HTMLElement>("[data-term]");
  if (termBtn?.dataset.term) {
    selectTerm(termBtn.dataset.term, "push");
    return;
  }
  const action = t.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "play") {
    await togglePlay();
    return;
  }
  if (action === "bypass") {
    state.bypass = !state.bypass;
    graph?.setBypass(state.bypass);
    paint();
    return;
  }
  if (action === "toggle-samples") {
    state.showSamples = !state.showSamples;
    paint();
    return;
  }
  if (action === "about") {
    state.showAbout = !state.showAbout;
    paint();
    return;
  }
  if (action === "theme") {
    toggleTheme();
    syncThemeState();
    paint();
    return;
  }
  if (action === "debug-dump") {
    const dump = {
      app: "audio-lexicon",
      version,
      catalogVersion: lex.version,
      selectedId: state.selectedId,
      values: state.values,
      sampleId: state.sampleId,
      userAgent: navigator.userAgent,
    };
    await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
    state.status = "Debug dump copied (no secrets).";
    paint();
    return;
  }
  if (action === "fetch-ia") {
    state.status = "Opening Internet Archive CC/PD audio search…";
    paint();
    window.open(
      "https://archive.org/search?query=collection%3Aopensource_audio%20AND%20(licenseurl%3A*creative*%20OR%20licenseurl%3A*publicdomain*)&and%5B%5D=mediatype%3A%22audio%22",
      "_blank",
      "noreferrer",
    );
    return;
  }
  const use = t.closest<HTMLElement>("[data-use-sample]")?.dataset.useSample;
  if (use) {
    await hotSwapSample(use);
    paint();
  }
});

app.addEventListener("input", (ev) => {
  const t = ev.target as HTMLInputElement | HTMLSelectElement;
  if (t.matches("[data-action=search]")) {
    state.query = (t as HTMLInputElement).value;
    paintTree(app, state);
    return;
  }
  if (t.matches("[data-param]")) {
    const id = t.dataset.param!;
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      state.values[id] = t.checked;
    } else if (t instanceof HTMLInputElement && t.type === "range") {
      state.values[id] = Number(t.value);
    } else {
      const raw = t.value;
      state.values[id] = Number.isNaN(Number(raw)) ? raw : Number(raw);
    }
    applyEffect();
    paintLive(app, state, id);
  }
});

app.addEventListener("change", (ev) => {
  const t = ev.target as HTMLSelectElement;
  if (!t.matches("[data-action=sample]")) return;
  void hotSwapSample(t.value);
});

window.addEventListener("popstate", () => {
  const id = termFromLocation();
  if (id === state.selectedId) return;
  state.selectedId = id;
  state.values = defaultParams(lex.terms[id]);
  applyEffect();
  paint();
});

window.addEventListener("resize", () => {
  paintLive(app, state);
});

initTheme(() => {
  syncThemeState();
  paint();
});
syncThemeState();
syncUrl(initialTerm, "replace");
paint();
