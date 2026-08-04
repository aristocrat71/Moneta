# Changelog

All notable changes to Moneta are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
Moneta uses [semantic versioning](https://semver.org/).

**This file is published.** The release workflow extracts the section matching
the tag being built and uses it as the GitHub release body, which `tauri-action`
also copies into `latest.json` — so it becomes the release notes every installed
copy of Moneta sees when it checks for updates. A tag with no matching section
here fails the release before anything is built. Write the entry as you merge,
not at tag time.

## [0.1.0] - Unreleased

The first release. Moneta is a handwriting app for external drawing tablets:
open it, write, and it stays written.

### Added

- **The Library.** Every notebook on one screen, grouped into projects,
  searchable with ⌘K. ⌘N starts a new notebook; clicking a card resumes exactly
  where the ink left off.
- **Pressure-sensitive ink.** Pen, highlighter, eraser, lasso select, and shapes
  (line, rectangle, circle, triangle), each with its own sizes. Tools live in an
  island at the bottom of the canvas and are one keystroke away — `P`, `H`, `E`,
  `S`, `R`.
- **Multi-page notebooks** with an overview sheet for jumping between pages.
- **Export** to vector PDF and SVG, plus PNG. Exports always render on light
  paper regardless of the theme you write in, and land in `~/Moneta/exports`.
- **Light and dark paper**, following the system theme by default.
- **Fully offline, plain files.** Notebooks are JSON at
  `~/Moneta/notebooks/<uuid>.moneta`, written atomically and versioned so older
  files migrate forward. Nothing leaves the machine.
- **Automatic updates.** Moneta checks for a new release at launch, downloads it
  in the background, and offers a restart — it never relaunches under you.
