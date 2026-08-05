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

## [0.5.0] - 2026-08-05

Write over your sources instead of beside them, and find your notebooks without
scrolling.

### Added

- **Glass paper.** Make the page see-through and write straight over whatever is
  behind the window — a PDF, a video, a design. A **Paper** slider takes the page
  from perfectly clear to a normal sheet, so you can keep as much or as little of
  it as you want. Glass lasts only as long as the notebook is open: close it and
  the real background is back, and thumbnails and exports never show glass.
- **Click-through** (`⌥⌘C`, in the background pop-over while glass is on). Hands
  the pointer to the app behind Moneta, so you can scroll the thing you're
  reading without switching windows. **Escape** takes the pointer back.
- **The library is a tree.** Every project and notebook on one screen with no
  scrolling; hover a notebook to peek at its ink, and walk the whole thing with
  the arrow keys. The thumbnail grid is still there — a toggle beside the search
  button switches between them, and Moneta remembers which you prefer.
- **Page backgrounds** — blank, ruled, grid, dotted — from a picker in the
  canvas top bar. The background belongs to the notebook: every page changes
  together, and one ⌘Z puts it back.
- **The page you're on is marked** in the page overview, which now opens scrolled
  to it rather than to page 1.

### Changed

- **New notebooks start dotted** instead of ruled — dots guide handwriting
  without ruling it.
- **"Full screen" is now "Fill screen".** It zooms the window to fill the display
  and back, instead of taking over a separate macOS Space with the menu bar
  hidden. Moneta is meant to sit beside your other windows.
- **The page count and the pages button moved to the bottom-right corner**, and
  full screen moved up beside the background picker.

## [0.1.0] - 2026-08-04

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
