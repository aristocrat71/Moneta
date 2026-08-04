# Moneta

> Moneta: epithet of Juno, Roman goddess of memory. An app for keeping what your hand writes.

A personal, minimalist macOS handwriting app for external drawing tablets.
Tauri 2 · Svelte 5 (runes) · TypeScript · Canvas 2D · perfect-freehand. Fully offline —
everything lives in `~/Moneta` as plain JSON.

Canonical docs: [`docs/DESIGN.md`](docs/DESIGN.md) (visual spec) ·
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) (architecture + milestones).

## Commands (Bun only)

```sh
bun install        # dependencies
bun tauri dev      # run the app
bun tauri build    # build the .app / .dmg
bun test           # vitest suite (geometry, migrations, undo, serialization)
bun run check      # svelte-check + eslint + prettier
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
```

Notebook data: `~/Moneta/notebooks/<uuid>.moneta` (format v1, versioned + migrated on
load). All writes are atomic (tmp + fsync + rename). Exports land in `~/Moneta/exports`.

Append `?dev` to the dev URL for the engine tweak panel (latency stats, smoothing,
pressure curve).
