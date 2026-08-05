#!/usr/bin/env bash
# Moneta installer — macOS only. Pulls a build from GitHub Releases, verifies its
# published SHA-256 checksum, installs it to /Applications, and clears the
# Gatekeeper quarantine flag. Fails closed: a missing or mismatched checksum
# aborts before anything is installed.
#
#   curl -fsSL https://raw.githubusercontent.com/aristocrat71/Moneta/v0.5.0/install.sh | bash
#
# Pin a specific version with MONETA_VERSION=vX.Y.Z; otherwise the latest release
# is used. No build toolchain required. Once installed, Moneta updates itself.
set -euo pipefail

REPO="aristocrat71/Moneta"
API_BASE="https://api.github.com/repos/${REPO}/releases"
API="${API_BASE}/latest"
[ -n "${MONETA_VERSION:-}" ] && API="${API_BASE}/tags/${MONETA_VERSION}"

say() { printf '\033[1;32m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "Moneta is macOS-only for now (got $(uname -s))."

# First asset download URL whose filename matches the given regex.
asset_url() {
  curl -fsSL "$API" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed 's/.*"\(https[^"]*\)"/\1/' \
    | grep -iE "$1" \
    | head -1
}

# Verify $1 against the "<file>.sha256" published next to its release asset ($2).
# Aborts on a missing checksum (fail closed) or any mismatch.
verify_sha() {
  local file="$1" url="$2" sums expected actual
  say "Verifying checksum…"
  sums="$(curl -fsSL "${url}.sha256")" \
    || die "no published checksum for $(basename "$url") — refusing to install"
  expected="$(printf '%s\n' "$sums" | awk '{print $1}' | head -1)"
  [ -n "$expected" ] || die "empty checksum for $(basename "$url")"
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  [ "$expected" = "$actual" ] \
    || die "checksum mismatch for $(basename "$url") (expected $expected, got $actual) — aborting"
}

say "Fetching the Moneta release…"
url="$(asset_url '\.dmg$')" || true
[ -n "${url:-}" ] || die "no macOS .dmg in that release"

tmp="$(mktemp -d)"
trap 'hdiutil detach "$tmp/mnt" -quiet 2>/dev/null || true; rm -rf "$tmp"' EXIT

say "Downloading $(basename "$url")…"
curl -fSL --progress-bar "$url" -o "$tmp/moneta.dmg"
verify_sha "$tmp/moneta.dmg" "$url"

mkdir -p "$tmp/mnt"
hdiutil attach "$tmp/moneta.dmg" -nobrowse -quiet -mountpoint "$tmp/mnt"
app="$(/usr/bin/find "$tmp/mnt" -maxdepth 1 -name '*.app' | head -1)"
[ -n "$app" ] || die "no .app inside the dmg"

name="$(basename "$app")"
running() { pgrep -f "/Applications/${name}/Contents/MacOS/" >/dev/null 2>&1; }

# Replacing a running copy pulls the bundle out from under it. Ask it to quit —
# which also lets it flush any unsaved ink — and only then overwrite. Matching on
# the install path, not the process name, so an editor with the word "Moneta" in
# its window doesn't count, and so this never launches the app just to quit it.
if running; then
  say "Quitting the running copy…"
  osascript -e "quit app \"${name%.app}\"" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    running || break
    sleep 0.5
  done
  if running; then
    die "Moneta is still running — quit it and re-run this installer"
  fi
fi

say "Installing to /Applications…"
rm -rf "/Applications/$name"
cp -R "$app" /Applications/

# Moneta isn't notarized yet, so Gatekeeper would otherwise refuse to open it.
# Stripping the quarantine flag skips that prompt — safe here because the
# download was already checksum-verified above, and the Gatekeeper prompt on an
# un-notarized app is a click-through, not an integrity check.
xattr -dr com.apple.quarantine "/Applications/$name" 2>/dev/null || true

say "Done — launch Moneta from /Applications or Spotlight."
