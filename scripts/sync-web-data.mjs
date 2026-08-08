/**
 * Sync catalog + version into the web adapter before build/dev.
 * Copies all curated audition files under samples/curated/ into public/samples/.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "adapters", "web", "src", "data");
mkdirSync(dest, { recursive: true });
copyFileSync(join(root, "catalog", "lexicon.json"), join(dest, "lexicon.json"));
copyFileSync(join(root, "version.json"), join(dest, "version.json"));

const curatedDir = join(root, "samples", "curated");
const sampleDestDir = join(root, "adapters", "web", "public", "samples");
mkdirSync(sampleDestDir, { recursive: true });

let copied = 0;
try {
  for (const name of readdirSync(curatedDir)) {
    if (!/\.(wav|mp3|ogg|flac)$/i.test(name)) continue;
    copyFileSync(join(curatedDir, name), join(sampleDestDir, name));
    copied += 1;
  }
} catch {
  console.warn("samples/curated missing — run pnpm generate:tone and pnpm fetch:curated");
}
console.log(`Synced web data + ${copied} curated audio file(s)`);
