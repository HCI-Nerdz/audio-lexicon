/**
 * Generate a short CC0 WAV bed (stereo) for offline audition.
 * Format: 16-bit PCM, 44.1 kHz, ~4 seconds of filtered noise + tones.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "samples", "curated");
mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;
const seconds = 4;
const numSamples = sampleRate * seconds;
const numChannels = 2;

function clamp16(n) {
  return Math.max(-32768, Math.min(32767, n | 0));
}

const data = new Int16Array(numSamples * numChannels);
let phase1 = 0;
let phase2 = 0;
let phase3 = 0;
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const env = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4);
  const noise = (Math.random() * 2 - 1) * 0.08;
  phase1 += (2 * Math.PI * 220) / sampleRate;
  phase2 += (2 * Math.PI * 660) / sampleRate;
  phase3 += (2 * Math.PI * (400 + 200 * Math.sin(2 * Math.PI * 0.5 * t))) / sampleRate;
  const tone =
    Math.sin(phase1) * 0.25 +
    Math.sin(phase2) * 0.12 +
    Math.sin(phase3) * 0.18 +
    noise;
  const l = clamp16(tone * env * 0.7 * 32767);
  const r = clamp16((tone * 0.85 + noise * 0.5) * env * 0.7 * 32767);
  data[i * 2] = l;
  data[i * 2 + 1] = r;
}

const dataBytes = data.byteLength;
const buffer = Buffer.alloc(44 + dataBytes);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * numChannels * 2, 28);
buffer.writeUInt16LE(numChannels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataBytes, 40);
Buffer.from(data.buffer).copy(buffer, 44);

const outPath = join(outDir, "tone-bed.wav");
writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath}`);
