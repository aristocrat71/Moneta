# Moneta

> Moneta: epithet of Juno, Roman goddess of memory. An app for keeping what your hand writes.

**[moneta website →](https://aristocrat71.github.io/Moneta/)**

A personal, minimalist macOS handwriting app for external drawing tablets.
Tauri 2 · Svelte 5 (runes) · TypeScript · Canvas 2D · perfect-freehand. Fully offline —
everything lives in `~/Moneta` as plain JSON.

Canonical docs: [`docs/DESIGN.md`](docs/DESIGN.md) (visual spec) ·
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) (architecture + milestones) ·
[`DEPLOY.md`](DEPLOY.md) (cutting a release).

## Install

macOS only, Apple Silicon or Intel:

```sh
curl -fsSL https://raw.githubusercontent.com/aristocrat71/Moneta/main/install.sh | bash
```

The script downloads the latest release, verifies its published SHA-256, installs
to `/Applications`, and clears the Gatekeeper quarantine flag (Moneta isn't
notarized yet). Pin a version with `MONETA_VERSION=vX.Y.Z`. After that Moneta
updates itself: it checks at launch, downloads in the background, and offers a
restart.

## Commands (Bun only)

```sh
bun install        # dependencies
bun tauri dev      # run the app
bun test           # vitest suite (geometry, migrations, undo, serialization)
bun run check      # svelte-check + eslint + prettier

# Release build. Bundling signs the updater artifact, so it needs the key —
# without it the .app and .dmg are still written but the command exits non-zero.
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/moneta-updater.key bun tauri build
```

Rust side: `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test` in `src-tauri/`.

## Layout

```
src/lib/ink/    the ink engine — framework-free TS, public surface engine.ts only
src/lib/doc/    document model, undoable commands, migrations, serialization
src/lib/store/  Svelte runes stores: settings, theme, library, open notebook
src/lib/ui/     island, cards, sheets, popovers
src/lib/export/ vector PDF / SVG / PNG export (always light-paper)
src-tauri/      Rust: atomic file I/O, library scan, FS watcher
assets/         source artwork; scripts/make-icon.py regenerates src-tauri/icons/
```

Notebook data: `~/Moneta/notebooks/<uuid>.moneta` (format v1, versioned + migrated on
load). All writes are atomic (tmp + fsync + rename). Exports land in `~/Moneta/exports`.

Append `?dev` to the dev URL for the engine tweak panel (latency stats, smoothing,
pressure curve).
