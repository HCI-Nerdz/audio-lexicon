import type { Lexicon, ParamValues, RelatedLink, Term, TreeNode } from "@hci-nerdz/core-ts";
import { exportBundle, filterTree, isHomeTerm, responseForAudition } from "@hci-nerdz/core-ts";
import versionJson from "../data/version.json";

const version = versionJson as { version: string; channel: string; name?: string };

export interface UiState {
  lex: Lexicon;
  query: string;
  selectedId: string;
  values: ParamValues;
  playing: boolean;
  bypass: boolean;
  sampleId: string;
  showSamples: boolean;
  showAbout: boolean;
  status: string;
}

let homeAtmosphereRaf = 0;

export function stopHomeAtmosphere() {
  if (homeAtmosphereRaf) cancelAnimationFrame(homeAtmosphereRaf);
  homeAtmosphereRaf = 0;
}

function paintHomeAtmosphere(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const t = performance.now() / 1000;
  ctx.strokeStyle = "rgba(15,107,92,0.22)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  ctx.lineTo(w, h * 0.58);
  ctx.stroke();

  ctx.lineWidth = 2.25;
  ctx.strokeStyle = "rgba(15, 107, 92, 0.7)";
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const u = x / w;
    const hz = Math.exp(Math.log(20) + u * (Math.log(20000) - Math.log(20)));
    const center = 800 + Math.sin(t * 0.35) * 180;
    const gain = 7 + Math.sin(t * 0.55) * 2;
    const q = 1.2 + Math.sin(t * 0.25) * 0.35;
    const oct = Math.log2(hz / center);
    const db = gain / (1 + (oct * oct) / (0.45 / q));
    const y = h * 0.58 - (db / 24) * h * 0.42;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(196, 92, 38, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const u = x / w;
    const y =
      h * 0.78 +
      Math.sin(u * Math.PI * 6 + t * 1.2) * 14 * Math.sin(u * Math.PI) +
      Math.sin(u * Math.PI * 14 + t * 2.1) * 5;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function startHomeAtmosphere(canvas: HTMLCanvasElement) {
  stopHomeAtmosphere();
  const loop = () => {
    paintHomeAtmosphere(canvas);
    homeAtmosphereRaf = requestAnimationFrame(loop);
  };
  loop();
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderRelatedLinks(links: RelatedLink[] | undefined): string {
  if (!links?.length) return "";
  return `<div class="section"><h2>Related projects</h2>
    <ul class="related-links">
      ${links
        .map(
          (l) => `<li>
            <a href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.label)}</a>
            ${l.blurb ? `<span class="meta">${escapeHtml(l.blurb)}</span>` : ""}
          </li>`,
        )
        .join("")}
    </ul>
  </div>`;
}

function renderTree(nodes: TreeNode[], selectedId: string): string {
  return nodes
    .map((n) => {
      if (n.termId) {
        const active = n.termId === selectedId ? " active" : "";
        const homeClass = n.termId === "home" ? " term-home" : "";
        return `<button type="button" class="term${homeClass}${active}" data-term="${escapeHtml(n.termId)}">${escapeHtml(n.label)}</button>`;
      }
      const kids = n.children ? renderTree(n.children, selectedId) : "";
      return `<details open><summary>${escapeHtml(n.label)}</summary>${kids}</details>`;
    })
    .join("");
}

function formatParamDisplay(
  value: number | boolean | string,
  unit: string | undefined,
  step: number | undefined,
): string {
  let text: string;
  if (typeof value === "number") {
    if (step != null && step > 0 && step < 1) {
      const places = Math.min(4, Math.max(1, Math.round(-Math.log10(step))));
      text = value.toFixed(places);
    } else {
      text = String(Math.round(value));
    }
  } else {
    text = String(value);
  }
  return unit ? `${text} ${unit}` : text;
}

function renderControls(term: Term, values: ParamValues): string {
  if (!term.parameters.length) {
    return `<p class="summary">No live parameters for this term${term.stub ? " (stub entry)" : ""}.</p>`;
  }
  return `<div class="controls">${term.parameters
    .map((p) => {
      const v = values[p.id] ?? p.default;
      if (p.kind === "bool") {
        return `<label class="control"><span>${escapeHtml(p.label)}</span><input type="checkbox" data-param="${p.id}" ${v ? "checked" : ""} /><span></span></label>`;
      }
      if (p.kind === "enum" && p.options) {
        return `<label class="control"><span>${escapeHtml(p.label)}</span><select data-param="${p.id}">${p.options
          .map(
            (o) =>
              `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === String(v) ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
          )
          .join("")}</select><span></span></label>`;
      }
      const num = Number(v);
      const display = formatParamDisplay(num, p.unit, p.step);
      return `<label class="control"><span>${escapeHtml(p.label)}</span><input type="range" data-param="${p.id}" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.step ?? 0.1}" value="${num}" /><span class="param-value" data-param-value="${escapeHtml(p.id)}">${escapeHtml(display)}</span></label>`;
    })
    .join("")}</div>`;
}

export function drawViz(canvas: HTMLCanvasElement, term: Term, values: ParamValues) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(15,107,92,0.25)";
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  if (term.viz === "conceptual") {
    ctx.fillStyle = "#4a5a52";
    ctx.font = "14px IBM Plex Sans, sans-serif";
    ctx.fillText("Conceptual term — no frequency curve", 8, h / 2 - 8);
    return;
  }

  if (term.viz === "envelope" || term.viz === "waveform") {
    ctx.strokeStyle = "#0f6b5c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const attack = Number(values.attack ?? 10) / 200;
      const release = Number(values.release ?? 100) / 2000;
      const depth = Number(values.depth ?? values.ratio ?? 4) / 20;
      let y = 0.55;
      if (term.audition === "tremolo") {
        y =
          0.5 +
          Math.sin(t * Math.PI * 8 * (Number(values.rate ?? 4) / 4)) *
            0.25 *
            (Number(values.depth ?? 50) / 100);
      } else {
        const env =
          t < attack
            ? t / Math.max(0.01, attack)
            : 1 - Math.min(1, (t - 0.55) / Math.max(0.05, release));
        y = 0.75 - Math.max(0, env) * (0.35 + depth * 0.2);
      }
      const py = y * h;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
    return;
  }

  const points = responseForAudition(term.audition, values as Record<string, number | boolean | string>);
  const minDb = -24;
  const maxDb = 24;
  ctx.strokeStyle = "#0f6b5c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.db - minDb) / (maxDb - minDb)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderHomePage(term: Term): string {
  return `
    <p class="eyebrow">HCI Nerdz · Audio literacy</p>
    <h2 class="hero-name">${escapeHtml(term.name)}</h2>
    <p class="summary">${escapeHtml(term.summary)}</p>

    <div class="section home-cta">
      <button type="button" class="land-btn primary" data-term="peaking-eq">Start with Peaking EQ</button>
      <div class="github-cta">
        <a
          class="land-btn github-btn"
          href="https://github.com/HCI-Nerdz/audio-lexicon"
          target="_blank"
          rel="noreferrer"
          aria-label="View audio-lexicon on GitHub"
          title="GitHub"
        >
          <svg class="github-logo" viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
        </a>
        <a
          class="github-stars"
          href="https://github.com/HCI-Nerdz/audio-lexicon"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub star count for HCI-Nerdz/audio-lexicon"
        >
          <img
            src="https://img.shields.io/github/stars/HCI-Nerdz/audio-lexicon?style=social"
            alt="GitHub stars"
            width="100"
            height="20"
            loading="lazy"
          />
        </a>
      </div>
    </div>

    <div class="section"><h2>Why it exists</h2><p>${escapeHtml(term.plainMeaning)}</p></div>
    <div class="section"><h2>What this project is</h2><p>${escapeHtml(term.history)}</p></div>
    <div class="section"><h2>How to use it</h2><p>${escapeHtml(term.whenToUse)}</p></div>
    <div class="section"><h2>What it is not</h2><p>${escapeHtml(term.commonConfusion)}</p></div>

    ${renderRelatedLinks(term.relatedLinks)}

    <div class="section"><h2>Atmosphere</h2>
      <div class="viz-wrap home-viz"><canvas data-viz></canvas></div>
    </div>
  `;
}

function renderTermPage(
  term: Term,
  state: UiState,
  bundle: ReturnType<typeof exportBundle>,
  samples: Lexicon["samples"],
): string {
  return `
        <p class="eyebrow">${escapeHtml(term.category)}${term.stub ? '<span class="stub-flag">stub</span>' : ""}</p>
        <h2 class="hero-name">${escapeHtml(term.name)}</h2>
        <p class="summary">${escapeHtml(term.summary)}</p>

        <div class="section"><h2>What it means</h2><p>${escapeHtml(term.plainMeaning)}</p></div>
        <div class="section"><h2>History / original usage</h2><p>${escapeHtml(term.history)}</p></div>
        <div class="section"><h2>When to use</h2><p>${escapeHtml(term.whenToUse)}</p></div>
        <div class="section"><h2>Common confusion</h2><p>${escapeHtml(term.commonConfusion)}</p></div>

        <div class="section"><h2>Visualization</h2>
          <div class="viz-wrap"><canvas data-viz></canvas></div>
        </div>

        <div class="section"><h2>Controls</h2>${renderControls(term, state.values)}</div>

        <div class="transport">
          <button type="button" class="primary" data-action="play">${state.playing ? "Stop" : "Play"}</button>
          <button
            type="button"
            class="fx-toggle ${state.bypass ? "is-off" : "is-on"}"
            data-action="bypass"
            role="switch"
            aria-checked="${state.bypass ? "false" : "true"}"
            aria-label="${state.bypass ? "Effect bypassed" : "Effect engaged"}"
            title="${state.bypass ? "Bypassed (A) — click to engage effect" : "Effect on (B) — click to bypass"}"
          >
            <span class="fx-lamp" aria-hidden="true"></span>
            <span class="fx-switch" aria-hidden="true"><span class="fx-thumb"></span></span>
            <span class="fx-copy">
              <span class="fx-title">Effect</span>
              <span class="fx-state">${state.bypass ? "Bypassed" : "Engaged"}</span>
            </span>
          </button>
          <label>Sample
            <select data-action="sample">
              ${samples
                .filter((s) => s.path)
                .map(
                  (s) =>
                    `<option value="${escapeHtml(s.id)}" ${s.id === state.sampleId ? "selected" : ""}>${escapeHtml(s.title)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <button type="button" data-action="toggle-samples">Download samples</button>
          <button type="button" data-action="about">About</button>
        </div>
        <p class="meta" data-status style="color:var(--muted);font-size:0.85rem">${escapeHtml(state.status)}</p>

        ${
          state.showSamples
            ? `<div class="panel"><h2 class="section" style="margin:0">Royalty-free samples</h2>
            <p class="summary">Curated CC0 / public-domain music ships for realistic A/B (pop-like, dubstep bass, reggae/dnb vocal, classical). Commercial hits cannot be bundled — license is shown on every track.</p>
            <ul class="sample-list">
              ${samples
                .map(
                  (s) => `<li>
                    <strong>${escapeHtml(s.title)}</strong>
                    <span class="meta">${escapeHtml(s.license)} · ${escapeHtml(s.source)} · ${escapeHtml(s.attribution)}</span>
                    ${s.downloadUrl ? `<a href="${escapeHtml(s.downloadUrl)}" target="_blank" rel="noreferrer">Open source</a>` : ""}
                    ${s.path ? `<button type="button" data-use-sample="${escapeHtml(s.id)}">Use for audition</button>` : ""}
                  </li>`,
                )
                .join("")}
            </ul>
            <button type="button" data-action="fetch-ia">Search Internet Archive (CC / PD)</button>
          </div>`
            : ""
        }

        ${
          state.showAbout
            ? `<div class="panel"><h2 class="section" style="margin:0">About / build</h2>
            <p>audio-lexicon ${escapeHtml(version.version)} (${escapeHtml(version.channel)})</p>
            <p>Catalog ${escapeHtml(state.lex.version)} · ${Object.keys(state.lex.terms).length} terms</p>
            <button type="button" data-action="debug-dump">Copy debug dump</button>
          </div>`
            : ""
        }

        <div class="section export"><h2>Export</h2>
          ${
            bundle.conceptualOnly
              ? `<p class="summary">Conceptual only — no EqualizerAPO / OBS map for this term.</p>`
              : `<pre>${escapeHtml(
                  [
                    bundle.equalizerApo ? `# EqualizerAPO\n${bundle.equalizerApo}` : null,
                    bundle.obs ? `# OBS-style properties\n${JSON.stringify(bundle.obs, null, 2)}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                )}</pre>`
          }
        </div>
  `;
}

export function render(root: HTMLElement, state: UiState) {
  stopHomeAtmosphere();
  const term = state.lex.terms[state.selectedId];
  const tree = filterTree(state.lex.tree, state.query, state.lex.terms);
  const bundle = term ? exportBundle(term, state.values) : null;
  const samples = state.lex.samples;
  const home = isHomeTerm(term);

  root.innerHTML = `
    <aside class="sidebar">
      <div>
        <p class="eyebrow"><a href="https://hci-nerdz.github.io/" target="_blank" rel="noreferrer">HCI Nerdz</a> · Lexicon</p>
        <h1>audio-lexicon</h1>
      </div>
      <input class="search" type="search" placeholder="Search terms…" value="${escapeHtml(state.query)}" data-action="search" />
      <div class="tree">${renderTree(tree, state.selectedId)}</div>
    </aside>
    <main class="main ${home ? "main-home" : ""}">
      ${
        term
          ? home
            ? renderHomePage(term)
            : renderTermPage(term, state, bundle!, samples)
          : `<p>Select a term.</p>`
      }
      <p class="about-line">Part of HCI Nerdz · MIT · Samples keep their own licenses.</p>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>("[data-viz]");
  if (canvas && term) {
    if (home) startHomeAtmosphere(canvas);
    else drawViz(canvas, term, state.values);
  }
}

/** Update viz / export / value labels without replacing the DOM (keeps range drag alive). */
export function paintLive(root: HTMLElement, state: UiState, paramId?: string) {
  const term = state.lex.terms[state.selectedId];
  if (!term || isHomeTerm(term)) return;

  if (paramId) {
    const def = term.parameters.find((p) => p.id === paramId);
    const el = root.querySelector<HTMLElement>(`[data-param-value="${CSS.escape(paramId)}"]`);
    if (el && def) {
      const v = state.values[paramId] ?? def.default;
      el.textContent = formatParamDisplay(v, def.unit, def.step);
    }
  }

  const canvas = root.querySelector<HTMLCanvasElement>("[data-viz]");
  if (canvas) drawViz(canvas, term, state.values);

  const bundle = exportBundle(term, state.values);
  const exportSection = root.querySelector(".export");
  if (exportSection) {
    exportSection.innerHTML = `<h2>Export</h2>${
      bundle.conceptualOnly
        ? `<p class="summary">Conceptual only — no EqualizerAPO / OBS map for this term.</p>`
        : `<pre>${escapeHtml(
            [
              bundle.equalizerApo ? `# EqualizerAPO\n${bundle.equalizerApo}` : null,
              bundle.obs ? `# OBS-style properties\n${JSON.stringify(bundle.obs, null, 2)}` : null,
            ]
              .filter(Boolean)
              .join("\n\n"),
          )}</pre>`
    }`;
  }
}

/** Rebuild only the term tree so the search field keeps focus. */
export function paintTree(root: HTMLElement, state: UiState) {
  const treeEl = root.querySelector(".tree");
  if (!treeEl) return;
  const tree = filterTree(state.lex.tree, state.query, state.lex.terms);
  treeEl.innerHTML = renderTree(tree, state.selectedId);
}
