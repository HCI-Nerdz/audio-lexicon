/** Approximate magnitude (dB) curves for viz — not a substitute for measured FR. */

export interface FreqPoint {
  hz: number;
  db: number;
}

function logSpace(min: number, max: number, n: number): number[] {
  const out: number[] = [];
  const a = Math.log(min);
  const b = Math.log(max);
  for (let i = 0; i < n; i++) out.push(Math.exp(a + ((b - a) * i) / (n - 1)));
  return out;
}

export function peakingResponse(freq: number, gainDb: number, q: number, n = 128): FreqPoint[] {
  return logSpace(20, 20000, n).map((hz) => {
    const x = Math.log2(hz / freq);
    const db = gainDb / (1 + (x * x) / (0.5 / Math.max(0.05, q)));
    return { hz, db };
  });
}

export function shelfResponse(freq: number, gainDb: number, low: boolean, n = 128): FreqPoint[] {
  return logSpace(20, 20000, n).map((hz) => {
    const t = 1 / (1 + Math.exp(-Math.log2(hz / freq) * (low ? -4 : 4)));
    const db = low ? gainDb * (1 - t) : gainDb * t;
    return { hz, db };
  });
}

export function passResponse(freq: number, q: number, highPass: boolean, n = 128): FreqPoint[] {
  return logSpace(20, 20000, n).map((hz) => {
    const oct = Math.log2(hz / freq);
    const slope = highPass ? (oct < 0 ? oct * 12 : 0) : oct > 0 ? -oct * 12 : 0;
    const bump = (q - 0.707) * Math.exp(-oct * oct * 4);
    return { hz, db: slope + bump };
  });
}

export function responseForAudition(
  audition: string,
  values: Record<string, number | boolean | string>,
): FreqPoint[] {
  const freq = Number(values.freq ?? 1000);
  const gain = Number(values.gain ?? 0);
  const q = Number(values.q ?? 1);
  switch (audition) {
    case "biquad-peaking":
      return peakingResponse(freq, gain, q);
    case "biquad-lowshelf":
      return shelfResponse(freq, gain, true);
    case "biquad-highshelf":
      return shelfResponse(freq, gain, false);
    case "biquad-lowpass":
      return passResponse(freq, q, false);
    case "biquad-highpass":
      return passResponse(freq, q, true);
    case "biquad-notch":
      return peakingResponse(freq, -24, q);
    case "biquad-bandpass":
      return peakingResponse(freq, 12, q).map((p) => ({
        hz: p.hz,
        db: p.db - 12 + (p.db > -1 ? 0 : -40),
      }));
    default:
      return logSpace(20, 20000, 64).map((hz) => ({ hz, db: 0 }));
  }
}
