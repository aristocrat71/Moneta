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

## [0.6.0] - 2026-08-05

Open a notebook and the page is already where you left the pen, and every key
you might want is one keystroke away.

### Added

- **Notebooks reopen where you were working.** Not the top of a page, and not
  just the right page — the exact spot of your last edit, whether that was a
  stroke, an erase, a rotate or a recolour. Scrolling around doesn't move it:
  the question is where you were working, not where you last looked. Notebooks
  written before this open the way they always did.
- **Keyboard shortcuts, on ⌘/.** A sheet listing everything the current screen
  answers to — one for the library, one for the notebook. The library also has
  a small keyboard button in the bottom-right corner; the canvas doesn't,
  because nothing should float over the page that a key can do.
- **About Moneta.** Click the wordmark: the icon, what the app is, and which
  version you're running.
- **Updates say what they're doing.** Finding one posts a toast, downloading
  shows a percentage, and a failed download now tells you instead of going
  quiet — a silent failure was indistinguishable from an app that never checks.
  **Settings has a Check for updates button** for asking on demand; it always
  answers, including "You're on the latest version".
- **New notebooks join the project you're working in.** ⌘N, **+ → New
  notebook**, and the ⌘K action all file the notebook into the most recently
  created project instead of dropping it into Unfiled. With no projects yet, it
  still goes to Unfiled.

### Changed

- **The tools moved to the number row.** `1` pen, `2` shapes, `3` eraser, `4`
  highlighter, `5` lasso — island order, left to right — and `2` followed by
  `1`–`4` picks the line, square, circle or triangle. `P`, `H`, `E`, `S` and `R`
  are gone: one run of digits is easier to keep than five unrelated letters.
- **Glass and click-through are two-key runs:** `g g` turns the paper
  see-through, `j j` hands the pointer to the window behind and takes it back
  again (Escape still works, and still always will). `⌥⌘C` is retired.
- **Width and colour lost their shortcuts.** `[`, `]` and the `1`–`9` swatch
  keys are gone; both still live one tap away in the island, and the digits are
  worth more as tools.
- **The eraser sits third in the island**, between shapes and the highlighter.
- **Theme moved into settings**, where the rest of the preferences are, and the
  wordmark it used to sit beside now opens About.

### Fixed

- **Rotating a lasso selection dragged it up or down the page.** It now turns
  about its own centre and stays there, at every angle.
- **The shape picker opened away from the shapes button.** Every island
  pop-over now opens centred on the button that summoned it, and shifts to stay
  on screen when the island is parked near an edge.

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
