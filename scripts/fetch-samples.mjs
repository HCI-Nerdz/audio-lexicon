/**
 * Fetch optional curated CC0 audio from Internet Archive into samples/cache.
 * Uses the IA metadata API; skips items without a clear license field match.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "samples", "cache");
mkdirSync(cacheDir, { recursive: true });

const query =
  "https://archive.org/advancedsearch.php?q=collection%3Aopensource_audio+AND+licenseurl%3A*publicdomain*+AND+format%3AVBR+MP3&fl[]=identifier,title,licenseurl&rows=5&page=1&output=json";

console.log("Searching Internet Archive for public-domain audio…");
const res = await fetch(query);
if (!res.ok) {
  console.error("Search failed:", res.status);
  process.exit(1);
}
const json = await res.json();
const docs = json?.response?.docs ?? [];
const manifest = [];

for (const doc of docs.slice(0, 3)) {
  const id = doc.identifier;
  const metaUrl = `https://archive.org/metadata/${id}`;
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) continue;
  const meta = await metaRes.json();
  const files = meta.files ?? [];
  const mp3 = files.find((f) => f.name?.toLowerCase().endsWith(".mp3") && !f.name.includes("64kb"));
  if (!mp3) continue;
  const fileUrl = `https://archive.org/download/${id}/${encodeURIComponent(mp3.name)}`;
  const localName = `${id}.mp3`;
  const localPath = join(cacheDir, localName);
  if (!existsSync(localPath)) {
    console.log(`Downloading ${doc.title}…`);
    const audio = await fetch(fileUrl);
    if (!audio.ok) continue;
    const buf = Buffer.from(await audio.arrayBuffer());
    writeFileSync(localPath, buf);
  }
  manifest.push({
    id: `ia-${id}`,
    title: doc.title ?? id,
    license: doc.licenseurl ?? "public-domain (IA)",
    source: "Internet Archive",
    path: `samples/cache/${localName}`,
    attribution: `${doc.title} — Internet Archive (${id})`,
    downloadUrl: fileUrl,
    curated: false,
  });
}

writeFileSync(join(cacheDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Cached ${manifest.length} item(s). License still shown in-app before use.`);
