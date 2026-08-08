import lexiconJson from "./data/lexicon.json";
import {
  createAuditionGraph,
  decodeAudioUrl,
  defaultParams,
  parseLexicon,
  type AuditionGraph,
  type Lexicon,
} from "@hci-nerdz/core-ts";
import { render, type UiState } from "./ui/render.js";
import "./styles.css";
import versionJson from "./data/version.json";

const version = versionJson as { version: string; channel: string; name?: string };

const lex: Lexicon = parseLexicon(lexiconJson);
const firstTerm =
  Object.values(lex.terms).find((t) => t.id === "peaking-eq")?.id ?? Object.keys(lex.terms)[0];

const state: UiState = {
  lex,
  query: "",
  selectedId: firstTerm,
  values: defaultParams(lex.terms[firstTerm]),
  playing: false,
  bypass: false,
  sampleId: lex.samples.find((s) => s.path)?.id ?? "",
  showSamples: false,
  showAbout: false,
  status: "Idle",
};

const app = document.querySelector<HTMLElement>("#app")!;
let graph: AuditionGraph | null = null;
let bufferCache = new Map<string, AudioBuffer>();

function sampleUrl(id: string): string | null {
  const s = lex.samples.find((x) => x.id === id);
  if (!s?.path) return null;
  // Vite public + monorepo: curated wav copied/served from public
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

async function togglePlay() {
  if (state.playing) {
    graph?.stop();
    state.playing = false;
    state.status = "Stopped";
    paint();
    return;
  }
  try {
    const g = await ensureGraph();
    const buf = await loadSample(state.sampleId);
    applyEffect();
    g.playBuffer(buf, true);
    state.playing = true;
    state.status = `Playing · ${lex.samples.find((s) => s.id === state.sampleId)?.attribution ?? ""}`;
  } catch (e) {
    state.status = `Audition error: ${e instanceof Error ? e.message : String(e)}`;
  }
  paint();
}

app.addEventListener("click", async (ev) => {
  const t = ev.target as HTMLElement;
  const termBtn = t.closest<HTMLElement>("[data-term]");
  if (termBtn?.dataset.term) {
    state.selectedId = termBtn.dataset.term;
    state.values = defaultParams(lex.terms[state.selectedId]);
    applyEffect();
    paint();
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
    state.sampleId = use;
    state.status = `Selected sample ${use}`;
    if (state.playing) {
      state.playing = false;
      graph?.stop();
      await togglePlay();
      return;
    }
    paint();
  }
});

app.addEventListener("input", (ev) => {
  const t = ev.target as HTMLInputElement | HTMLSelectElement;
  if (t.matches("[data-action=search]")) {
    state.query = (t as HTMLInputElement).value;
    paint();
    return;
  }
  if (t.matches("[data-action=sample]")) {
    state.sampleId = (t as HTMLSelectElement).value;
    paint();
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
    paint();
  }
});

window.addEventListener("resize", () => paint());
paint();
