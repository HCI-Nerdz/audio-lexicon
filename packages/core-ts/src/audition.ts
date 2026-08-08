import type { AuditionKind, ParamValues } from "./types.js";

export interface AuditionGraph {
  ctx: AudioContext;
  source: AudioBufferSourceNode | null;
  input: GainNode;
  output: GainNode;
  wet: GainNode;
  dry: GainNode;
  bypass: boolean;
  dispose: () => void;
  setBypass: (bypass: boolean) => void;
  apply: (kind: AuditionKind, values: ParamValues) => void;
  playBuffer: (buffer: AudioBuffer, loop?: boolean) => void;
  stop: () => void;
}

function clearChain(node: AudioNode) {
  // disconnect downstream only via recreate — handled in apply
  void node;
}

export function createAuditionGraph(ctx: AudioContext): AuditionGraph {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  input.connect(dry);
  dry.connect(output);
  wet.connect(output);

  let effectNodes: AudioNode[] = [];
  let source: AudioBufferSourceNode | null = null;
  let bypass = false;

  const disconnectEffects = () => {
    for (const n of effectNodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    effectNodes = [];
    try {
      input.disconnect();
    } catch {
      /* ignore */
    }
    input.connect(dry);
  };

  const graph: AuditionGraph = {
    ctx,
    source: null,
    input,
    output,
    wet,
    dry,
    bypass: false,
    dispose: () => {
      graph.stop();
      disconnectEffects();
      void ctx.close();
    },
    setBypass: (b: boolean) => {
      bypass = b;
      graph.bypass = b;
      dry.gain.value = b ? 1 : 0;
      wet.gain.value = b ? 0 : 1;
    },
    apply: (kind, values) => {
      disconnectEffects();
      dry.gain.value = bypass ? 1 : 0;
      wet.gain.value = bypass ? 0 : 1;

      const connectEffect = (entry: AudioNode, exit: AudioNode = entry) => {
        input.connect(entry);
        exit.connect(wet);
        effectNodes.push(entry);
        if (exit !== entry) effectNodes.push(exit);
      };

      const freq = Number(values.freq ?? 1000);
      const gainDb = Number(values.gain ?? 0);
      const q = Number(values.q ?? 1);

      switch (kind) {
        case "biquad-peaking":
        case "biquad-lowshelf":
        case "biquad-highshelf":
        case "biquad-lowpass":
        case "biquad-highpass":
        case "biquad-notch":
        case "biquad-bandpass":
        case "biquad-allpass": {
          const biquad = ctx.createBiquadFilter();
          const typeMap: Record<string, BiquadFilterType> = {
            "biquad-peaking": "peaking",
            "biquad-lowshelf": "lowshelf",
            "biquad-highshelf": "highshelf",
            "biquad-lowpass": "lowpass",
            "biquad-highpass": "highpass",
            "biquad-notch": "notch",
            "biquad-bandpass": "bandpass",
            "biquad-allpass": "allpass",
          };
          biquad.type = typeMap[kind];
          biquad.frequency.value = freq;
          biquad.Q.value = q;
          biquad.gain.value = gainDb;
          connectEffect(biquad);
          break;
        }
        case "gain": {
          const g = ctx.createGain();
          g.gain.value = Math.pow(10, gainDb / 20);
          connectEffect(g);
          break;
        }
        case "delay": {
          const delay = ctx.createDelay(1.5);
          const feedback = ctx.createGain();
          const mix = ctx.createGain();
          delay.delayTime.value = Number(values.time ?? 250) / 1000;
          feedback.gain.value = Number(values.feedback ?? 25) / 100;
          mix.gain.value = Number(values.mix ?? 30) / 100;
          input.connect(delay);
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(mix);
          mix.connect(wet);
          const dryPass = ctx.createGain();
          dryPass.gain.value = 1 - mix.gain.value;
          input.connect(dryPass);
          dryPass.connect(wet);
          effectNodes.push(delay, feedback, mix, dryPass);
          break;
        }
        case "tremolo": {
          const g = ctx.createGain();
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = Number(values.rate ?? 4);
          depth.gain.value = Number(values.depth ?? 50) / 200;
          g.gain.value = 1 - depth.gain.value;
          lfo.connect(depth);
          depth.connect(g.gain);
          lfo.start();
          connectEffect(g);
          effectNodes.push(lfo, depth);
          break;
        }
        case "pan": {
          const panner = ctx.createStereoPanner();
          panner.pan.value = Number(values.pan ?? values.balance ?? 0) / 100;
          connectEffect(panner);
          break;
        }
        case "compressor":
        case "ducking": {
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = Number(values.threshold ?? -18);
          comp.ratio.value = Number(values.ratio ?? (kind === "ducking" ? 8 : 4));
          comp.attack.value = Number(values.attack ?? 10) / 1000;
          comp.release.value = Number(values.release ?? 100) / 1000;
          const makeup = ctx.createGain();
          const makeupDb = Number(values.makeup ?? values.depth ?? 0);
          makeup.gain.value = Math.pow(10, (kind === "ducking" ? -Number(values.depth ?? 9) : makeupDb) / 20);
          input.connect(comp);
          comp.connect(makeup);
          makeup.connect(wet);
          effectNodes.push(comp, makeup);
          break;
        }
        case "gate": {
          // Soft gate approximation via expander-ish compressor curve + makeup
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = Number(values.threshold ?? -40);
          comp.ratio.value = 12;
          comp.attack.value = Number(values.attack ?? 1) / 1000;
          comp.release.value = Number(values.release ?? 200) / 1000;
          connectEffect(comp);
          break;
        }
        case "none":
        default: {
          const g = ctx.createGain();
          g.gain.value = 1;
          connectEffect(g);
          break;
        }
      }
      clearChain(input);
    },
    playBuffer: (buffer, loop = true) => {
      graph.stop();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = loop;
      src.connect(input);
      src.start();
      source = src;
      graph.source = src;
    },
    stop: () => {
      if (source) {
        try {
          source.stop();
          source.disconnect();
        } catch {
          /* ignore */
        }
        source = null;
        graph.source = null;
      }
    },
  };

  graph.setBypass(false);
  return graph;
}

export async function decodeAudioUrl(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf.slice(0));
}
