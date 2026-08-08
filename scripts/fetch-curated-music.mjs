/**
 * Download pinned CC0 / public-domain audition tracks into samples/curated/.
 * Commercial artists (Skrillex, M.I.A., etc.) are intentionally not included —
 * SoundCloud hosting or “free stream” is not a redistribution license.
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "samples", "curated");
mkdirSync(outDir, { recursive: true });

/** @type {Array<{
 *  id: string,
 *  title: string,
 *  role: string,
 *  license: string,
 *  source: string,
 *  attribution: string,
 *  archiveId: string,
 *  remoteName: string,
 *  localName: string,
 *  curated: true
 * }>} */
export const CURATED_MUSIC = [
  {
    id: "pop-catch-that-wave",
    title: "Catch that Wave (pop-like)",
    role: "pop-like full-band energy for general EQ A/B",
    license: "CC0-1.0",
    source: "Internet Archive / AI AM Pop",
    attribution: "Catch that Wave — AI AM Pop (Internet Archive ai-am-pop), CC0-1.0",
    archiveId: "ai-am-pop",
    remoteName: "Catch that Wave.mp3",
    localName: "pop-catch-that-wave.mp3",
    curated: true,
  },
  {
    id: "pop-lemon-yellow",
    title: "Lemon Yellow (bright pop/synth)",
    role: "brighter pop/synth top end for high-shelf and harshness tests",
    license: "CC0-1.0",
    source: "Internet Archive / AI AM Pop",
    attribution: "Lemon Yellow — AI AM Pop (Internet Archive ai-am-pop), CC0-1.0",
    archiveId: "ai-am-pop",
    remoteName: "Lemon Yellow.mp3",
    localName: "pop-lemon-yellow.mp3",
    curated: true,
  },
  {
    id: "dubstep-fyah-kosmik",
    title: "FYAH Dubstep (bass / drops)",
    role: "dubstep wobble and drop energy for low-end and limiter tests (Skrillex stand-in role)",
    license: "CC0-1.0",
    source: "Internet Archive / kosmik",
    attribution: "FYAH 2025 DUBSTEP WKD KOSMIK — kosmik (Internet Archive fyah-2025-dubstep-wkd-kosmik), CC0-1.0",
    archiveId: "fyah-2025-dubstep-wkd-kosmik",
    remoteName: "FYAH__2025_DUBSTEP_WKD_KOSMIK.mp3",
    localName: "dubstep-fyah-kosmik.mp3",
    curated: true,
  },
  {
    id: "reggae-voice-of-jah",
    title: "Voice of Jah People (reggae/dnb vocal)",
    role: "reggae/dnb vocal + transient material (Paper Planes audition role; not the M.I.A. recording)",
    license: "CC0-1.0",
    source: "Internet Archive / kosmik",
    attribution: "DNB 85 Voice of Jah People — kosmik pack (Internet Archive fyah-2025-dubstep-wkd-kosmik), CC0-1.0",
    archiveId: "fyah-2025-dubstep-wkd-kosmik",
    remoteName: "DNB_85_VOICE_OF_JAH_PEOPLE.mp3",
    localName: "reggae-voice-of-jah.mp3",
    curated: true,
  },
  {
    id: "classical-beethoven-5-i",
    title: "Beethoven Symphony No. 5 — I (Musopen)",
    role: "digitally released Musopen classical master for dynamics, width, and natural timbre",
    license: "Public Domain Mark 1.0 (composition + Musopen performance)",
    source: "Internet Archive / Musopen",
    attribution:
      "Beethoven Symphony No. 5 in C minor, Op. 67 — I. Allegro con brio — Musopen (Internet Archive SymphonyNo.5), Public Domain",
    archiveId: "SymphonyNo.5",
    remoteName: "Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor_op._67_-_i._allegro_con_brio.mp3",
    localName: "classical-beethoven-5-i.mp3",
    curated: true,
  },
];

export function iaUrl(archiveId, remoteName) {
  return `https://archive.org/download/${archiveId}/${encodeURIComponent(remoteName)}`;
}

export function curatedSampleEntries() {
  return CURATED_MUSIC.map((t) => ({
    id: t.id,
    title: t.title,
    license: t.license,
    source: t.source,
    path: `samples/curated/${t.localName}`,
    attribution: t.attribution,
    downloadUrl: iaUrl(t.archiveId, t.remoteName),
    curated: true,
  }));
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log("skip (exists)", dest);
    return;
  }
  console.log("GET", url);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log("wrote", dest, `(${statSync(dest).size} bytes)`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  for (const track of CURATED_MUSIC) {
    const dest = join(outDir, track.localName);
    await download(iaUrl(track.archiveId, track.remoteName), dest);
  }
  writeFileSync(
    join(outDir, "music-manifest.json"),
    JSON.stringify(curatedSampleEntries(), null, 2),
  );
  console.log(`Curated ${CURATED_MUSIC.length} tracks.`);
}
