# Agent notes — audio-lexicon

## Product

Pro-audio filter and processing literacy UI. Shared `catalog/` is the source of truth; GUI adapters are thin shells over the same information architecture.

## Machine facts

Workstation / path facts live only in `$CODE_ROOT/MEMORIES.md` (never commit a per-repo `MEMORIES.md`).

## Layout

- `catalog/` — terms, taxonomy, curated sample metadata
- `schemas/` — JSON Schema for catalog validation
- `packages/core-ts/` — TypeScript parse/search/params/export/Web Audio recipes
- `adapters/web` — reference Vite demo (GitHub Pages)
- `adapters/d-gtkd` — D + GtkD
- `adapters/cpp-qt` — C++ + Qt 6 (EqualizerAPO-aligned stack)
- `adapters/cpp-imgui` — C++ + Dear ImGui
- `adapters/rust-iced` / `adapters/rust-egui` — Rust GUIs
- `adapters/obs-dock` — out-of-tree OBS Qt dock (**do not PR to OBS upstream**)

## Conventions

- AsciiDoc for README/changelog/docs
- Allow-list `.gitignore`
- Changelog timeline + `changelog-details/date - title`
- Version truth in `version.json`
