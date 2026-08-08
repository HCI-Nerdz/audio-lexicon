/**
 * Sync catalog + version into the web adapter before build/dev.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "adapters", "web", "src", "data");
mkdirSync(dest, { recursive: true });
copyFileSync(join(root, "catalog", "lexicon.json"), join(dest, "lexicon.json"));
copyFileSync(join(root, "version.json"), join(dest, "version.json"));
const sampleSrc = join(root, "samples", "curated", "tone-bed.wav");
const sampleDestDir = join(root, "adapters", "web", "public", "samples");
mkdirSync(sampleDestDir, { recursive: true });
try {
  copyFileSync(sampleSrc, join(sampleDestDir, "tone-bed.wav"));
} catch {
  console.warn("tone-bed.wav missing — run pnpm generate:tone first");
}
console.log("Synced web data + sample");
