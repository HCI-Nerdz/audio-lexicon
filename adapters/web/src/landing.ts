import "./landing.css";

const base = import.meta.env.BASE_URL;

const root = document.querySelector("#landing")!;
root.innerHTML = `
  <div class="land-atmosphere" aria-hidden="true">
    <canvas class="land-viz" data-viz width="1200" height="720"></canvas>
  </div>

  <header class="land-hero">
    <p class="land-eyebrow">
      <a href="https://hci-nerdz.github.io/">HCI Nerdz</a>
      <span aria-hidden="true">·</span>
      <span>Audio literacy</span>
    </p>
    <h1 class="land-brand">audio-lexicon</h1>
    <p class="land-lede">
      Pro apps bury filters behind jargon. This UI teaches what each setting means — history, sound, and controls — before you trust a knob.
    </p>
    <p class="land-cta">
      <a class="land-btn primary" href="${base}app.html">Open the lexicon</a>
      <a class="land-btn" href="https://github.com/HCI-Nerdz/audio-lexicon">GitHub project</a>
    </p>
  </header>

  <section class="land-purpose" aria-labelledby="purpose-heading">
    <h2 id="purpose-heading">Why it exists</h2>
    <p>
      Equalizers, ducking, sidechain, Q, shelves — the words arrived from radio, consoles, and speakers.
      Most UIs assume you already speak that dialect. <strong>audio-lexicon</strong> puts a searchable term tree
      beside plain-language meaning, original usage, a live curve or envelope, and A/B audition on royalty-free audio.
    </p>
    <p>
      When a term maps cleanly, you can copy EqualizerAPO snippets or OBS-style property maps.
      When it does not, the UI says so — literacy first, not pretend host power.
    </p>
  </section>

  <footer class="land-foot">
    <a href="https://hci-nerdz.github.io/demos/">Demos</a>
    <span aria-hidden="true">·</span>
    <a href="${base}app.html">Lexicon app</a>
    <span aria-hidden="true">·</span>
    <a href="https://github.com/HCI-Nerdz/audio-lexicon">Repository</a>
  </footer>
`;

function paintCurve(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const t = performance.now() / 1000;
  ctx.lineWidth = 2.25;
  ctx.strokeStyle = "rgba(15, 107, 92, 0.55)";
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

  ctx.strokeStyle = "rgba(196, 92, 38, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const u = x / w;
    const y =
      h * 0.72 +
      Math.sin(u * Math.PI * 6 + t * 1.2) * 18 * Math.sin(u * Math.PI) +
      Math.sin(u * Math.PI * 14 + t * 2.1) * 6;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

const canvas = root.querySelector<HTMLCanvasElement>("[data-viz]")!;
let raf = 0;
const loop = () => {
  paintCurve(canvas);
  raf = requestAnimationFrame(loop);
};
loop();
window.addEventListener("resize", () => paintCurve(canvas), { passive: true });
window.addEventListener("pagehide", () => cancelAnimationFrame(raf));
