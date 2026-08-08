import type { Lexicon, ParamValues, Term, TreeNode } from "@hci-nerdz/core-ts";
import { exportBundle, filterTree, responseForAudition } from "@hci-nerdz/core-ts";
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTree(nodes: TreeNode[], selectedId: string): string {
  return nodes
    .map((n) => {
      if (n.termId) {
        const active = n.termId === selectedId ? " active" : "";
        return `<button type="button" class="term${active}" data-term="${escapeHtml(n.termId)}">${escapeHtml(n.label)}</button>`;
      }
      const kids = n.children ? renderTree(n.children, selectedId) : "";
      return `<details open><summary>${escapeHtml(n.label)}</summary>${kids}</details>`;
    })
    .join("");
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
      return `<label class="control"><span>${escapeHtml(p.label)}</span><input type="range" data-param="${p.id}" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.step ?? 0.1}" value="${num}" /><span>${num}${p.unit ? " " + escapeHtml(p.unit) : ""}</span></label>`;
    })
    .join("")}</div>`;
}

function drawViz(canvas: HTMLCanvasElement, term: Term, values: ParamValues) {
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
        y = 0.5 + Math.sin(t * Math.PI * 8 * (Number(values.rate ?? 4) / 4)) * 0.25 * (Number(values.depth ?? 50) / 100);
      } else {
        const env = t < attack ? t / Math.max(0.01, attack) : 1 - Math.min(1, (t - 0.55) / Math.max(0.05, release));
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

export function render(root: HTMLElement, state: UiState) {
  const term = state.lex.terms[state.selectedId];
  const tree = filterTree(state.lex.tree, state.query, state.lex.terms);
  const bundle = term ? exportBundle(term, state.values) : null;
  const samples = state.lex.samples;

  root.innerHTML = `
    <aside class="sidebar">
      <div>
        <p class="eyebrow"><a href="${import.meta.env.BASE_URL}">Home</a> · <a href="https://hci-nerdz.github.io/" target="_blank" rel="noreferrer">HCI Nerdz</a> · Lexicon</p>
        <h1>audio-lexicon</h1>
      </div>
      <input class="search" type="search" placeholder="Search terms…" value="${escapeHtml(state.query)}" data-action="search" />
      <div class="tree">${renderTree(tree, state.selectedId)}</div>
    </aside>
    <main class="main">
      ${
        term
          ? `
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
          <button type="button" class="${state.bypass ? "active" : ""}" data-action="bypass">${state.bypass ? "Bypassed (A)" : "Effect (B)"}</button>
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
        <p class="meta" style="color:var(--muted);font-size:0.85rem">${escapeHtml(state.status)}</p>

        ${
          state.showSamples
            ? `<div class="panel"><h2 class="section" style="margin:0">Royalty-free samples</h2>
            <p class="summary">Curated CC0 bed ships offline. Online results show license before you fetch.</p>
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
            bundle?.conceptualOnly
              ? `<p class="summary">Conceptual only — no EqualizerAPO / OBS map for this term.</p>`
              : `<pre>${escapeHtml(
                  [
                    bundle?.equalizerApo ? `# EqualizerAPO\n${bundle.equalizerApo}` : null,
                    bundle?.obs ? `# OBS-style properties\n${JSON.stringify(bundle.obs, null, 2)}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                )}</pre>`
          }
        </div>
      `
          : `<p>Select a term.</p>`
      }
      <p class="about-line">Part of HCI Nerdz · MIT · Samples keep their own licenses.</p>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>("[data-viz]");
  if (canvas && term) drawViz(canvas, term, state.values);
}
