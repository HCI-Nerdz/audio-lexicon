/**
 * Builds catalog/lexicon.json — run via: node scripts/build-catalog.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const freqParams = [
  { id: "freq", label: "Frequency", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 },
  { id: "gain", label: "Gain", kind: "float", unit: "dB", min: -24, max: 24, step: 0.1, default: 0 },
  { id: "q", label: "Q", kind: "float", unit: "", min: 0.1, max: 20, step: 0.1, default: 1.0 },
];

const dynParams = [
  { id: "threshold", label: "Threshold", kind: "float", unit: "dB", min: -60, max: 0, step: 0.5, default: -18 },
  { id: "ratio", label: "Ratio", kind: "float", unit: ":1", min: 1, max: 20, step: 0.1, default: 4 },
  { id: "attack", label: "Attack", kind: "float", unit: "ms", min: 0.1, max: 200, step: 0.1, default: 10 },
  { id: "release", label: "Release", kind: "float", unit: "ms", min: 1, max: 2000, step: 1, default: 100 },
  { id: "makeup", label: "Makeup gain", kind: "float", unit: "dB", min: 0, max: 24, step: 0.1, default: 0 },
];

function term(partial) {
  return {
    aliases: [],
    stub: false,
    parameters: [],
    audition: "none",
    exports: {},
    commonConfusion: "",
    whenToUse: "",
    ...partial,
  };
}

function stub(id, name, category, summary) {
  return term({
    id,
    name,
    category,
    summary,
    plainMeaning: summary,
    history: "Term used across professional mixing, mastering, and live sound; details expand in later catalog revisions.",
    whenToUse: "When the host or plugin exposes this control or label.",
    commonConfusion: "Often confused with neighboring terms in the same category.",
    viz: "conceptual",
    stub: true,
  });
}

const terms = {};

function add(t) {
  terms[t.id] = t;
}

// —— EQ / filters (rich) ——
add(term({
  id: "peaking-eq",
  name: "Peaking EQ (bell)",
  aliases: ["parametric EQ band", "bell filter", "peak filter"],
  category: "eq-filters",
  summary: "Boost or cut a band of frequencies around a center point.",
  plainMeaning: "A bell-shaped boost or cut centered on a frequency you choose. Narrow Q affects fewer neighbors; wide Q is gentler and broader.",
  history: "Grew out of 1970s parametric equalizers (e.g. George Massenburg) that let engineers sweep frequency, gain, and bandwidth continuously instead of fixed graphic bands.",
  whenToUse: "Fix a resonant note, add presence, or carve space between instruments.",
  commonConfusion: "Not a shelf (which tilts everything above/below a point) and not a graphic EQ slider (fixed center frequencies).",
  viz: "freq-response",
  parameters: freqParams.map((p) => ({ ...p, default: p.id === "gain" ? 6 : p.default })),
  audition: "biquad-peaking",
  exports: {
    equalizerApo: "Filter: ON PK Fc {freq} Hz Gain {gain} dB Q {q}",
    obs: { filter_type: "peak_filter", frequency: "{freq}", gain: "{gain}", q: "{q}" },
  },
}));

add(term({
  id: "low-pass",
  name: "Low-pass (high-cut)",
  aliases: ["LPF", "high-cut"],
  category: "eq-filters",
  summary: "Lets lows through; attenuates highs above the cutoff.",
  plainMeaning: "Frequencies above the cutoff are reduced. Steeper slopes remove highs more aggressively.",
  history: "Classic analog synthesis and loudspeaker crossover building block; ‘high-cut’ is the mix-desk name for the same idea.",
  whenToUse: "Tame harshness, hide noise, or keep a bass part from competing with cymbals.",
  commonConfusion: "Low-pass removes highs; high-pass removes lows. Names describe what they pass, not what they cut.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 8000 },
    { id: "q", label: "Q / resonance", kind: "float", unit: "", min: 0.1, max: 10, step: 0.1, default: 0.707 },
  ],
  audition: "biquad-lowpass",
  exports: {
    equalizerApo: "Filter: ON LPQ Fc {freq} Hz Q {q}",
    obs: { filter_type: "low_pass_filter_2_pole", cutoff_hz: "{freq}" },
  },
}));

add(term({
  id: "high-pass",
  name: "High-pass (low-cut)",
  aliases: ["HPF", "low-cut", "rumble filter"],
  category: "eq-filters",
  summary: "Lets highs through; attenuates lows below the cutoff.",
  plainMeaning: "Cuts rumble and low mud while keeping the rest of the signal. Every vocal and many mics start here.",
  history: "Recording-console channel strips standardized low-cut switches long before DAW plugins; slopes often 6–24 dB/oct.",
  whenToUse: "Clean mic stands, HVAC rumble, and unused low end before mixing.",
  commonConfusion: "People say ‘roll off the lows’ meaning high-pass, not low-pass.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 2000, step: 1, default: 80 },
    { id: "q", label: "Q / resonance", kind: "float", unit: "", min: 0.1, max: 10, step: 0.1, default: 0.707 },
  ],
  audition: "biquad-highpass",
  exports: {
    equalizerApo: "Filter: ON HPQ Fc {freq} Hz Q {q}",
    obs: { filter_type: "high_pass_filter_2_pole", cutoff_hz: "{freq}" },
  },
}));

add(term({
  id: "low-shelf",
  name: "Low shelf",
  aliases: ["bass shelf"],
  category: "eq-filters",
  summary: "Boost or cut everything below a corner frequency by roughly the same amount.",
  plainMeaning: "A gentle tilt of the bass region rather than a narrow bell. Think ‘more/less bass’ as a broad stroke.",
  history: "Tone controls on hi-fi amps and mixing desks used shelving filters decades before parametric bells were common.",
  whenToUse: "Overall bass weight without surgically targeting one note.",
  commonConfusion: "A shelf changes a whole region; a peaking band is local.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Corner", kind: "float", unit: "Hz", min: 20, max: 1000, step: 1, default: 120 },
    { id: "gain", label: "Gain", kind: "float", unit: "dB", min: -24, max: 24, step: 0.1, default: 3 },
  ],
  audition: "biquad-lowshelf",
  exports: {
    equalizerApo: "Filter: ON LSC Fc {freq} Hz Gain {gain} dB",
    obs: { filter_type: "low_shelf", frequency: "{freq}", gain: "{gain}" },
  },
}));

add(term({
  id: "high-shelf",
  name: "High shelf",
  aliases: ["treble shelf", "air shelf"],
  category: "eq-filters",
  summary: "Boost or cut everything above a corner frequency.",
  plainMeaning: "Broad treble or ‘air’ control. Often used for polish rather than surgical fixes.",
  history: "Companion to the bass shelf on classic tone stacks and console channel EQs.",
  whenToUse: "Add sheen or reduce harshness across the top end.",
  commonConfusion: "Not the same as a high-pass (which removes lows).",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Corner", kind: "float", unit: "Hz", min: 1000, max: 20000, step: 1, default: 8000 },
    { id: "gain", label: "Gain", kind: "float", unit: "dB", min: -24, max: 24, step: 0.1, default: 3 },
  ],
  audition: "biquad-highshelf",
  exports: {
    equalizerApo: "Filter: ON HSC Fc {freq} Hz Gain {gain} dB",
    obs: { filter_type: "high_shelf", frequency: "{freq}", gain: "{gain}" },
  },
}));

add(term({
  id: "notch",
  name: "Notch (band-reject)",
  aliases: ["band-reject", "narrow cut"],
  category: "eq-filters",
  summary: "Deep, narrow cut at a center frequency.",
  plainMeaning: "Scoops out a thin slice—useful for hum, feedback, or a single bad resonance.",
  history: "Feedback destroyers and graphic notches in live sound popularized surgical reject filters.",
  whenToUse: "Kill 50/60 Hz hum harmonics or a ringing room mode without gutting the tone.",
  commonConfusion: "A notch is a cut; peaking EQ can boost or cut.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Frequency", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 60 },
    { id: "q", label: "Q", kind: "float", unit: "", min: 1, max: 100, step: 0.5, default: 10 },
  ],
  audition: "biquad-notch",
  exports: {
    equalizerApo: "Filter: ON NO Fc {freq} Hz Q {q}",
    obs: { filter_type: "notch_filter", frequency: "{freq}", q: "{q}" },
  },
}));

add(term({
  id: "band-pass",
  name: "Band-pass",
  aliases: ["BPF"],
  category: "eq-filters",
  summary: "Passes a mid band; attenuates below and above.",
  plainMeaning: "Only a slice of the spectrum remains—telephone effects, drum tuning, creative filtering.",
  history: "Standard second-order filter type in analog synthesis (alongside LP/HP/notch).",
  whenToUse: "Special effects or isolating a frequency region for analysis.",
  commonConfusion: "Band-pass keeps a band; band-reject (notch) removes one.",
  viz: "freq-response",
  parameters: freqParams.filter((p) => p.id !== "gain").concat([
    { id: "q", label: "Q", kind: "float", unit: "", min: 0.1, max: 20, step: 0.1, default: 2 },
  ]),
  audition: "biquad-bandpass",
  exports: {
    equalizerApo: "Filter: ON BP Fc {freq} Hz Q {q}",
  },
}));

add(term({
  id: "all-pass",
  name: "All-pass",
  aliases: ["phase EQ"],
  category: "eq-filters",
  summary: "Keeps magnitude flat while shifting phase around a frequency.",
  plainMeaning: "You may not hear a solo all-pass as a tone change, but it rearranges phase—useful in crossovers and phasers.",
  history: "Critical in Linkwitz-Riley crossovers and analog phaser circuits.",
  whenToUse: "Phase alignment, multi-way speakers, and modulation FX building blocks.",
  commonConfusion: "‘All-pass’ does not mean ‘no effect’—phase still moves.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Frequency", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 },
    { id: "q", label: "Q", kind: "float", unit: "", min: 0.1, max: 10, step: 0.1, default: 0.707 },
  ],
  audition: "biquad-allpass",
  exports: {
    equalizerApo: "Filter: ON AP Fc {freq} Hz Q {q}",
  },
}));

add(term({
  id: "q-bandwidth",
  name: "Q / bandwidth",
  aliases: ["Q factor", "BW"],
  category: "eq-filters",
  summary: "How wide or narrow an EQ band is.",
  plainMeaning: "Higher Q = narrower bell. Bandwidth is the inverse idea expressed in octaves.",
  history: "Q comes from resonant circuits in electronics; audio borrowed the same dimensionless ratio.",
  whenToUse: "Decide whether a cut should be surgical or musical.",
  commonConfusion: "Q is not gain. Gain is how much; Q is how wide.",
  viz: "freq-response",
  parameters: [{ id: "q", label: "Q", kind: "float", unit: "", min: 0.1, max: 20, step: 0.1, default: 1 }],
  audition: "biquad-peaking",
}));

add(term({
  id: "slope-db-oct",
  name: "Slope (dB/octave)",
  aliases: ["filter order", "12 dB/oct", "24 dB/oct"],
  category: "eq-filters",
  summary: "How steeply a filter attenuates past the cutoff.",
  plainMeaning: "Each doubling of frequency (one octave), level drops by N dB past the cutoff for an ideal slope description.",
  history: "Filter order (1st, 2nd, 4th…) maps to 6 dB/oct steps in classic analog designs.",
  whenToUse: "Choose gentle musical rolls vs surgical bricks.",
  commonConfusion: "Steeper is not always better—phase and resonance change too.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 },
    {
      id: "order",
      label: "Order",
      kind: "enum",
      default: 2,
      options: [
        { value: 1, label: "6 dB/oct" },
        { value: 2, label: "12 dB/oct" },
        { value: 4, label: "24 dB/oct" },
      ],
    },
  ],
  audition: "biquad-lowpass",
}));

add(term({
  id: "butterworth",
  name: "Butterworth",
  category: "eq-filters",
  summary: "Maximally flat passband filter response family.",
  plainMeaning: "No ripple in the passband; common default for ‘transparent’ crossovers and HPFs.",
  history: "Named after Stephen Butterworth (1930 paper on filter amplifiers).",
  whenToUse: "When you want a clean, predictable roll-off without passband ripple.",
  commonConfusion: "Butterworth vs Linkwitz-Riley: LR is often preferred for speaker crossovers because summed response is flat.",
  viz: "freq-response",
  parameters: [{ id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 }],
  audition: "biquad-lowpass",
}));

add(term({
  id: "linkwitz-riley",
  name: "Linkwitz-Riley",
  aliases: ["LR4", "LR crossover"],
  category: "eq-filters",
  summary: "Crossover filter alignment that sums flat on-axis.",
  plainMeaning: "Even-order Linkwitz-Riley is cascaded Butterworth sections (LR4 = two 2nd-order Butter stages). Lows and highs sum flat when each side uses the matching high/low pair.",
  history: "Siegfried Linkwitz and Russ Riley; widely taught in DIY speaker and PA system design.",
  whenToUse: "Designing or understanding speaker/PA crossovers.",
  commonConfusion: "Not every DAW ‘crossover’ is true LR alignment.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Crossover", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 },
    {
      id: "order",
      label: "Order",
      kind: "enum",
      default: 4,
      options: [
        { value: 2, label: "LR2 (12 dB/oct)" },
        { value: 4, label: "LR4 (24 dB/oct)" },
        { value: 8, label: "LR8 (48 dB/oct)" },
      ],
    },
    {
      id: "side",
      label: "Side",
      kind: "enum",
      default: "low",
      options: [
        { value: "low", label: "Low-pass half" },
        { value: "high", label: "High-pass half" },
      ],
    },
  ],
  audition: "linkwitz-riley",
}));

const graphicBands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
add(term({
  id: "graphic-eq",
  name: "Graphic EQ",
  category: "eq-filters",
  summary: "Bank of fixed-frequency boost/cut sliders.",
  plainMeaning: "You see a ‘graphic’ of the curve as slider positions. Fast for live tuning; less precise than full parametric. This demo is a 10-band octave graphic.",
  history: "Live sound and consumer hi-fi popularized octave and 1/3-octave graphic equalizers.",
  whenToUse: "Room tuning, feedback hunting, broad tonal shape.",
  commonConfusion: "Graphic ≠ parametric; centers are fixed.",
  viz: "freq-response",
  parameters: graphicBands.map((hz) => ({
    id: `g${hz}`,
    label: hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`,
    kind: "float",
    unit: "dB",
    min: -12,
    max: 12,
    step: 0.5,
    default: 0,
  })),
  audition: "graphic-eq",
  exports: {
    equalizerApo: `GraphicEQ: ${graphicBands.map((hz) => `${hz} {g${hz}}`).join("; ")}`,
  },
}));

add(term({
  id: "linear-vs-minimum-phase",
  name: "Linear-phase vs minimum-phase",
  category: "eq-filters",
  summary: "Two ways EQ can treat phase while changing frequency balance.",
  plainMeaning: "Minimum-phase (typical analog-style) shifts phase as it EQ’s. Linear-phase keeps phase relationships but can introduce pre-ringing and latency. This browser audition uses Web Audio biquads — minimum-phase only — so you can still feel the magnitude EQ while reading the phase trade-off.",
  history: "Digital EQ made linear-phase practical; analog desks were inherently minimum-phase.",
  whenToUse: "Mastering surgical cuts sometimes use linear-phase; tracking often prefers minimum-phase.",
  commonConfusion: "Linear-phase is not ‘higher quality’ by default—trade latency and pre-echo.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Frequency", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 2500 },
    { id: "gain", label: "Gain", kind: "float", unit: "dB", min: -24, max: 24, step: 0.1, default: 6 },
    { id: "q", label: "Q", kind: "float", unit: "", min: 0.1, max: 20, step: 0.1, default: 2 },
    {
      id: "phaseMode",
      label: "Phase mode",
      kind: "enum",
      default: "minimum",
      options: [
        { value: "minimum", label: "Minimum-phase (auditioned)" },
        { value: "linear", label: "Linear-phase (magnitude only here)" },
      ],
    },
  ],
  audition: "biquad-peaking",
}));

add(term({
  id: "cutoff",
  name: "Cutoff frequency",
  category: "eq-filters",
  summary: "The corner where a filter begins its primary roll-off.",
  plainMeaning: "Usually defined at −3 dB for many classic filters.",
  history: "Inherited from electrical filter theory.",
  whenToUse: "Any LP/HP/shelf/crossover control labeled frequency or cutoff.",
  commonConfusion: "Cutoff is not always where the sound ‘disappears’—slope still continues.",
  viz: "freq-response",
  parameters: [{ id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000 }],
  audition: "biquad-lowpass",
}));

add(term({
  id: "resonance",
  name: "Resonance",
  aliases: ["filter emphasis"],
  category: "eq-filters",
  summary: "Emphasis near the cutoff, related to Q.",
  plainMeaning: "On synth filters, resonance peaking at the cutoff creates the classic ‘wah’ or scream.",
  history: "Moog and other subtractive synths made resonant low-pass iconic.",
  whenToUse: "Creative filter sweeps; use sparingly on mix EQ.",
  commonConfusion: "Resonance can self-oscillate on some designs—not the same as a gentle EQ Q.",
  viz: "freq-response",
  parameters: [
    { id: "freq", label: "Cutoff", kind: "float", unit: "Hz", min: 20, max: 20000, step: 1, default: 800 },
    { id: "q", label: "Resonance", kind: "float", unit: "", min: 0.1, max: 20, step: 0.1, default: 5 },
  ],
  audition: "biquad-lowpass",
}));

// —— Dynamics (rich) ——
add(term({
  id: "compressor",
  name: "Compressor",
  category: "dynamics",
  summary: "Automatically reduces level when the signal exceeds a threshold.",
  plainMeaning: "Turns down loud parts (and often adds makeup gain) so dynamics sit more evenly.",
  history: "Broadcast and recording from the mid-20th century used leveling amplifiers (e.g. LA-2A, 1176) before digital plugins.",
  whenToUse: "Control peaks, glue a bus, or shape punch with attack/release.",
  commonConfusion: "Compression reduces dynamic range; limiting is a high-ratio special case.",
  viz: "envelope",
  parameters: dynParams,
  audition: "compressor",
  exports: {
    obs: { filter: "compressor_filter", ratio: "{ratio}", threshold: "{threshold}", attack_time: "{attack}", release_time: "{release}" },
  },
}));

add(term({
  id: "limiter",
  name: "Limiter",
  category: "dynamics",
  summary: "Compressor with a very high ratio that prevents exceeding a ceiling.",
  plainMeaning: "A ‘brick wall’ (or soft) ceiling so peaks cannot pass a set level.",
  history: "Broadcast transmitters and vinyl cutting required peak protection; brickwall limiters became mastering staples in the loudness era.",
  whenToUse: "Catch peaks before clipping; mastering ceilings; live protection.",
  commonConfusion: "A limiter still needs sensible threshold/ceiling—it is not magic headroom.",
  viz: "envelope",
  parameters: [
    { id: "ceiling", label: "Ceiling", kind: "float", unit: "dB", min: -12, max: 0, step: 0.1, default: -1 },
    { id: "release", label: "Release", kind: "float", unit: "ms", min: 1, max: 500, step: 1, default: 50 },
  ],
  audition: "compressor",
}));

add(term({
  id: "expander",
  name: "Expander",
  category: "dynamics",
  summary: "Increases dynamic range by turning down signals below a threshold.",
  plainMeaning: "Quiet parts get quieter—opposite direction of a compressor.",
  history: "Noise reduction and creative dynamics; related to gates.",
  whenToUse: "Reduce room noise between phrases without a hard gate chop.",
  commonConfusion: "Expander ≠ compressor; watch the transfer curve direction.",
  viz: "envelope",
  parameters: dynParams,
  audition: "gate",
  stub: true,
}));

add(term({
  id: "gate",
  name: "Noise gate",
  aliases: ["gate"],
  category: "dynamics",
  summary: "Mutes or attenuates when level falls below a threshold.",
  plainMeaning: "When the signal is quiet enough, the gate closes. Attack/hold/release shape the open/close.",
  history: "Live drums and guitar amps used gates to kill bleed; still standard on console channels.",
  whenToUse: "Drum bleed, noisy amps, podcast room tone between words (carefully).",
  commonConfusion: "Too-high threshold chops consonants and decays.",
  viz: "envelope",
  parameters: [
    { id: "threshold", label: "Threshold", kind: "float", unit: "dB", min: -80, max: 0, step: 0.5, default: -40 },
    { id: "attack", label: "Attack", kind: "float", unit: "ms", min: 0.1, max: 100, step: 0.1, default: 1 },
    { id: "release", label: "Release", kind: "float", unit: "ms", min: 1, max: 2000, step: 1, default: 200 },
  ],
  audition: "gate",
  exports: {
    obs: { filter: "noise_gate_filter", open_threshold: "{threshold}", attack_time: "{attack}", close_threshold: "{threshold}", hold_time: 200, release_time: "{release}" },
  },
}));

add(term({
  id: "ducking",
  name: "Ducking",
  aliases: ["auto-duck", "voice-over duck"],
  category: "dynamics",
  summary: "One signal’s level automatically turns another down.",
  plainMeaning: "Music ducks under speech: when the voice is present, the bed gets quieter, then recovers.",
  history: "Radio voice-over and broadcast production; sidechain compression popularized the effect in dance music.",
  whenToUse: "Podcasts, streams, ads—keep voice intelligible over beds.",
  commonConfusion: "Ducking is a use-case; the mechanism is usually sidechain compression or a dedicated duck module.",
  viz: "envelope",
  parameters: [
    { id: "depth", label: "Duck depth", kind: "float", unit: "dB", min: 0, max: 24, step: 0.5, default: 9 },
    { id: "attack", label: "Attack", kind: "float", unit: "ms", min: 1, max: 200, step: 1, default: 20 },
    { id: "release", label: "Release", kind: "float", unit: "ms", min: 50, max: 2000, step: 10, default: 400 },
  ],
  audition: "ducking",
  exports: {
    obs: { note: "OBS uses compressor sidechain / source ducking depending on version and filter setup" },
  },
}));

add(term({
  id: "sidechain",
  name: "Sidechain",
  category: "dynamics",
  summary: "A detector path that listens to a different signal than the one being processed.",
  plainMeaning: "The compressor (or gate) watches signal B to control signal A—classic kick-ducks-bass.",
  history: "Hardware compressors offered key/sidechain inputs; EDM made ‘sidechain’ a household word.",
  whenToUse: "Ducking, de-essing (split-band key), kick/bass pumping.",
  commonConfusion: "Sidechain is the control path, not a genre.",
  viz: "envelope",
  parameters: dynParams,
  audition: "ducking",
}));

add(term({
  id: "threshold",
  name: "Threshold",
  category: "dynamics",
  summary: "Level where dynamics processing starts acting.",
  plainMeaning: "Above (compressor) or below (gate/expander) this level, the device changes gain.",
  history: "Standard control on leveling amps and VCA compressors.",
  whenToUse: "Set how much of the signal engages the processor.",
  commonConfusion: "Threshold alone does nothing without ratio/range.",
  viz: "envelope",
  parameters: [{ id: "threshold", label: "Threshold", kind: "float", unit: "dB", min: -60, max: 0, step: 0.5, default: -18 }],
  audition: "compressor",
}));

add(term({
  id: "ratio",
  name: "Ratio",
  category: "dynamics",
  summary: "How strongly levels above threshold are reduced.",
  plainMeaning: "4:1 means 4 dB over threshold becomes 1 dB at the output (idealized).",
  history: "VCA and FET compressor front panels standardized ratio switches.",
  whenToUse: "Gentle glue (low ratio) vs leveling/limiting (high).",
  commonConfusion: "∞:1 is limiting territory.",
  viz: "envelope",
  parameters: [{ id: "ratio", label: "Ratio", kind: "float", unit: ":1", min: 1, max: 20, step: 0.1, default: 4 }],
  audition: "compressor",
}));

add(term({
  id: "attack-release",
  name: "Attack / release",
  category: "dynamics",
  summary: "How fast processing engages and recovers.",
  plainMeaning: "Attack: how quickly gain reduction starts. Release: how quickly it returns.",
  history: "Timing constants define the ‘character’ of classic compressors as much as the gain cell.",
  whenToUse: "Preserve transients (slower attack) or catch them (fast attack).",
  commonConfusion: "Fast everything can sound pumpy or distorted; context matters.",
  viz: "envelope",
  parameters: [
    { id: "attack", label: "Attack", kind: "float", unit: "ms", min: 0.1, max: 200, step: 0.1, default: 10 },
    { id: "release", label: "Release", kind: "float", unit: "ms", min: 1, max: 2000, step: 1, default: 100 },
  ],
  audition: "compressor",
}));

add(term({
  id: "knee",
  name: "Knee",
  category: "dynamics",
  summary: "Whether compression onset is abrupt (hard) or gradual (soft).",
  plainMeaning: "Soft knee starts reducing gain before the exact threshold for a smoother transition.",
  history: "Described in compressor manuals as hard vs soft knee curves.",
  whenToUse: "Soft for transparent vocals; hard for assertive leveling.",
  commonConfusion: "Knee is not the same as ratio.",
  viz: "envelope",
  stub: true,
}));

add(term({
  id: "makeup-gain",
  name: "Makeup gain",
  category: "dynamics",
  summary: "Output gain to compensate for compression reduction.",
  plainMeaning: "After turning peaks down, boost the whole signal so loudness matches again.",
  history: "Always present on hardware compressors so comparative leveling was possible.",
  whenToUse: "Match perceived loudness when A/B’ing bypass.",
  commonConfusion: "Makeup can fool you into thinking ‘more compression = better’ because louder wins.",
  viz: "envelope",
  parameters: [{ id: "makeup", label: "Makeup", kind: "float", unit: "dB", min: 0, max: 24, step: 0.1, default: 6 }],
  audition: "compressor",
}));

add(term({
  id: "parallel-compression",
  name: "Parallel compression",
  aliases: ["New York compression"],
  category: "dynamics",
  summary: "Blend a heavily compressed copy under the dry signal.",
  plainMeaning: "Keep transients from the dry path while adding body from a squashed parallel path.",
  history: "Associated with NYC mix engineers; also called Motown-style parallel techniques in drum rooms.",
  whenToUse: "Drums, vocals, mix bus density without killing punch.",
  commonConfusion: "Requires a send/blend; not just ‘more ratio’ on one insert.",
  viz: "envelope",
  stub: true,
}));

add(term({
  id: "multiband-dynamics",
  name: "Multiband dynamics",
  category: "dynamics",
  summary: "Split the spectrum and compress/limit each band separately.",
  plainMeaning: "Control boom without dulling highs, or tame harshness without thinning lows.",
  history: "Broadcast processors and mastering chains adopted multiband limiting heavily.",
  whenToUse: "Mastering, podcast leveling, uneven spectra.",
  commonConfusion: "More bands ≠ better; crossovers can smear if overused.",
  viz: "spectrum",
  stub: true,
}));

add(term({
  id: "upward-compression",
  name: "Upward compression",
  category: "dynamics",
  summary: "Raises quieter signals toward a target instead of only cutting peaks.",
  plainMeaning: "Brings up detail under a ceiling rather than only suppressing loud bits.",
  history: "Discussed in modern digital processors and some vintage leveling philosophies.",
  whenToUse: "Dialogue consistency without squashing peaks as hard.",
  commonConfusion: "Not the same as makeup gain alone.",
  viz: "envelope",
  stub: true,
}));

// —— Time / space ——
const timeSpace = [
  ["delay", "Delay", "Echo repeats after a set time.", "delay", [
    { id: "time", label: "Time", kind: "float", unit: "ms", min: 1, max: 1000, step: 1, default: 250 },
    { id: "feedback", label: "Feedback", kind: "float", unit: "%", min: 0, max: 95, step: 1, default: 25 },
    { id: "mix", label: "Mix", kind: "float", unit: "%", min: 0, max: 100, step: 1, default: 30 },
  ]],
  ["slapback", "Slapback delay", "Single short echo familiar from 1950s rockabilly.", "delay", [
    { id: "time", label: "Time", kind: "float", unit: "ms", min: 40, max: 200, step: 1, default: 90 },
    { id: "mix", label: "Mix", kind: "float", unit: "%", min: 0, max: 100, step: 1, default: 25 },
  ]],
  ["ping-pong", "Ping-pong delay", "Repeats alternate left/right.", "delay", [
    { id: "time", label: "Time", kind: "float", unit: "ms", min: 1, max: 1000, step: 1, default: 300 },
    { id: "feedback", label: "Feedback", kind: "float", unit: "%", min: 0, max: 95, step: 1, default: 35 },
  ]],
  ["reverb", "Reverb", "Simulated room reflections (early + late).", "none", [
    { id: "decay", label: "Decay", kind: "float", unit: "s", min: 0.1, max: 8, step: 0.1, default: 1.8 },
    { id: "mix", label: "Mix", kind: "float", unit: "%", min: 0, max: 100, step: 1, default: 25 },
  ]],
  ["pre-delay", "Pre-delay", "Silence before reverb tail starts—clarifies dry source.", "none", []],
  ["dry-wet", "Dry / wet", "Blend of unprocessed vs processed signal.", "none", [
    { id: "mix", label: "Wet", kind: "float", unit: "%", min: 0, max: 100, step: 1, default: 50 },
  ]],
  ["convolution", "Convolution", "Imprint an impulse response (room, gear) onto audio.", "none", []],
];
for (const [id, name, summary, audition, parameters] of timeSpace) {
  add(term({
    id,
    name,
    category: "time-space",
    summary,
    plainMeaning: summary,
    history: "Studio effects evolved from tape loops, plates, chambers, and digital algorithms into plugin standards.",
    whenToUse: "Space, rhythm, and depth in mixes.",
    commonConfusion: "Delay is discrete repeats; reverb is dense reflections.",
    viz: audition === "delay" ? "waveform" : "conceptual",
    parameters,
    audition,
    stub: parameters.length === 0,
  }));
}

// —— Modulation ——
const mods = [
  ["chorus", "Chorus", "Detuned/delayed copies thicken the sound.", "tremolo"],
  ["flanger", "Flanger", "Short modulated delay with feedback—jet whoosh.", "tremolo"],
  ["phaser", "Phaser", "All-pass stages create sweeping notches.", "tremolo"],
  ["tremolo", "Tremolo", "Amplitude modulation (volume wobble).", "tremolo"],
  ["vibrato", "Vibrato", "Pitch modulation (frequency wobble).", "none"],
  ["pitch-shift", "Pitch shift", "Change pitch with or without changing duration.", "none"],
  ["autotune", "Pitch correction (Auto-Tune)", "Detect and nudge pitch toward a scale.", "none"],
];
for (const [id, name, summary, audition] of mods) {
  add(term({
    id,
    name,
    category: "modulation",
    summary,
    plainMeaning: summary,
    history: "Analog pedals and studio racks defined these names; digital plugins emulate and extend them.",
    whenToUse: "Motion, width, or corrective pitch work.",
    commonConfusion: "Tremolo = level; vibrato = pitch.",
    viz: "waveform",
    parameters: [
      { id: "rate", label: "Rate", kind: "float", unit: "Hz", min: 0.1, max: 20, step: 0.1, default: 4 },
      { id: "depth", label: "Depth", kind: "float", unit: "%", min: 0, max: 100, step: 1, default: 50 },
    ],
    audition,
    stub: audition === "none",
  }));
}

// —— Utility / routing ——
const utils = [
  ["gain-preamp", "Gain / preamp", "Input level staging before processing.", "gain", [
    { id: "gain", label: "Gain", kind: "float", unit: "dB", min: -24, max: 24, step: 0.1, default: 0 },
  ], { equalizerApo: "Preamp: {gain} dB" }],
  ["pan", "Pan", "Place a mono-compatible signal in the stereo field.", "pan", [
    { id: "pan", label: "Pan", kind: "float", unit: "", min: -100, max: 100, step: 1, default: 0 },
  ]],
  ["balance", "Balance", "Left/right level balance for a stereo source.", "pan", [
    { id: "balance", label: "Balance", kind: "float", unit: "", min: -100, max: 100, step: 1, default: 0 },
  ]],
  ["mute-solo", "Mute / solo", "Silence a channel or isolate it for listening.", "none", []],
  ["bus-aux", "Bus / aux / send / return", "Routing paths for grouping and shared effects.", "none", []],
  ["insert", "Insert", "Processor placed directly in a channel’s signal path.", "none", []],
  ["phase-invert", "Phase invert (polarity)", "Flip waveform polarity—fixes cancellation with miswired mics.", "none", []],
  ["mono-sum", "Mono sum", "Combine L+R to mono to check compatibility.", "none", []],
  ["stereo-width", "Stereo width", "Narrow or widen the stereo image.", "none", []],
  ["mid-side", "Mid / Side (M/S)", "Encode stereo as center (mid) + difference (side).", "none", []],
  ["dither", "Dither", "Low-level noise when reducing bit depth to hide quantization.", "none", []],
  ["sample-rate", "Sample rate", "How many amplitude snapshots per second (e.g. 48 kHz).", "none", []],
  ["bit-depth", "Bit depth", "Amplitude resolution per sample (e.g. 24-bit).", "none", []],
  ["latency", "Latency", "Delay through the digital path (buffer + plugins).", "none", []],
  ["buffering", "Buffering", "Block size trade-off between CPU stability and latency.", "none", []],
];
for (const row of utils) {
  const [id, name, summary, audition, parameters, exports] = row;
  add(term({
    id,
    name,
    category: "utility-routing",
    summary,
    plainMeaning: summary,
    history: "Console topology and digital audio fundamentals; names stuck as DAWs mirrored desks.",
    whenToUse: "Gain staging, routing, and format decisions.",
    commonConfusion: "Pan (mono placement) vs balance (stereo lean).",
    viz: audition === "gain" || audition === "pan" ? "waveform" : "conceptual",
    parameters: parameters || [],
    audition: audition || "none",
    exports: exports || {},
    stub: !parameters || parameters.length === 0,
  }));
}

// —— Metering ——
const meters = [
  ["peak", "Peak", "Instantaneous maximum sample/level reading."],
  ["rms", "RMS", "Averaged power-like level—closer to perceived loudness than peak."],
  ["lufs", "LUFS / LKFS", "Broadcast loudness units (ITU-R BS.1770 family)."],
  ["true-peak", "True peak", "Inter-sample peak estimate after reconstruction."],
  ["spectrum", "Spectrum analyzer", "Level vs frequency display."],
  ["spectrogram", "Spectrogram", "Frequency vs time intensity plot."],
  ["correlation", "Stereo correlation", "How similar L and R are (−1 to +1)."],
  ["crest-factor", "Crest factor", "Ratio of peak to RMS—transient density clue."],
];
for (const [id, name, summary] of meters) {
  add(term({
    id,
    name,
    category: "metering",
    summary,
    plainMeaning: summary,
    history: "Metering evolved from mechanical VU/PPM to digital sample meters and loudness standards.",
    whenToUse: "Judging levels, loudness compliance, and phase.",
    commonConfusion: "Peak ≠ loudness; LUFS is for program loudness.",
    viz: id.includes("spectrum") || id === "spectrogram" ? "spectrum" : "conceptual",
    stub: true,
  }));
}

// —— Broadcast / live / OBS ——
const broadcast = [
  ["noise-suppression", "Noise suppression", "Estimate and reduce stationary or learned noise.", "obs", { filter: "noise_suppress_filter" }],
  ["noise-gate-live", "Noise gate (live/OBS)", "Gate tuned for mics on streams and conferences.", "obs", { filter: "noise_gate_filter" }],
  ["vst-host", "VST / plugin host", "Host loads third-party processors in a DAW or wrapper.", "none", null],
  ["apo", "APO (Audio Processing Object)", "Windows user-mode audio effect injected in the shared audio engine—Equalizer APO’s niche.", "none", null],
  ["loudness-norm", "Loudness normalization", "Adjust gain to a target LUFS for platforms/broadcast.", "none", null],
  ["duck-under-voice", "Duck under voice", "Practical ducking of music/beds under speech for streams.", "none", null],
  ["monitor-vs-program", "Monitor vs program", "Cue/headphone mix vs what the audience hears.", "none", null],
];
for (const [id, name, summary, _kind, obs] of broadcast) {
  add(term({
    id,
    name,
    category: "broadcast-live",
    summary,
    plainMeaning: summary,
    history: "Live sound, broadcast engineering, and streaming tools reused studio vocabulary with platform-specific filters.",
    whenToUse: "Streaming, podcasts, and system-wide Windows processing.",
    commonConfusion: "APO is not a VST host; OBS filters are per-source, not system-wide.",
    viz: "conceptual",
    exports: obs ? { obs } : {},
    stub: true,
  }));
}

const tree = [
  {
    id: "eq-filters",
    label: "EQ & filters",
    children: [
      "peaking-eq", "low-pass", "high-pass", "low-shelf", "high-shelf", "notch", "band-pass", "all-pass",
      "q-bandwidth", "slope-db-oct", "cutoff", "resonance", "butterworth", "linkwitz-riley", "graphic-eq",
      "linear-vs-minimum-phase",
    ].map((id) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "dynamics",
    label: "Dynamics",
    children: [
      "compressor", "limiter", "expander", "gate", "ducking", "sidechain", "threshold", "ratio",
      "attack-release", "knee", "makeup-gain", "parallel-compression", "multiband-dynamics", "upward-compression",
    ].map((id) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "time-space",
    label: "Time & space",
    children: timeSpace.map(([id]) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "modulation",
    label: "Pitch & modulation",
    children: mods.map(([id]) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "utility-routing",
    label: "Utility & routing",
    children: utils.map(([id]) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "metering",
    label: "Metering & analysis",
    children: meters.map(([id]) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
  {
    id: "broadcast-live",
    label: "Broadcast, live & OBS",
    children: broadcast.map(([id]) => ({ id: `node-${id}`, label: terms[id].name, termId: id })),
  },
];

const samples = [
  {
    id: "tone-sweep-cc0",
    title: "Generated tone + noise bed (CC0)",
    license: "CC0-1.0",
    source: "audio-lexicon",
    path: "samples/curated/tone-bed.wav",
    attribution: "Generated by audio-lexicon scripts (CC0).",
    curated: true,
  },
  {
    id: "ia-search-hint",
    title: "Internet Archive — search more CC music",
    license: "varies (check item)",
    source: "Internet Archive",
    path: "",
    attribution: "Use in-app browser; only download items with clear CC0/CC-BY licenses.",
    downloadUrl: "https://archive.org/search?query=subject%3A%22cc0%22%20AND%20mediatype%3Aaudio",
    curated: false,
  },
];

const lexicon = { version: "0.1.0", tree, terms, samples };
mkdirSync(join(root, "catalog"), { recursive: true });
writeFileSync(join(root, "catalog", "lexicon.json"), JSON.stringify(lexicon, null, 2));
console.log(`Wrote catalog with ${Object.keys(terms).length} terms`);
