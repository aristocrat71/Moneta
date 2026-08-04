// Vector SVG export — one file per page, always light-paper rendering.

import {
  DEFAULT_TUNING,
  HIGHLIGHT_ALPHA_LIGHT,
  outlineToSvgPath,
  resolveInk,
  strokeOutline,
  type ThemePaint,
} from '$lib/ink/engine';
import type { DocPage } from '$lib/doc/model';

const STEP = 44;
const RULED_TOP = 128;
const RULED_BOTTOM = 64;
const RULED_INSET = 48;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function templateSvg(page: DocPage, paint: ThemePaint): string {
  const { w, h } = page.size;
  const parts: string[] = [];
  if (page.template === 'ruled') {
    for (let y = RULED_TOP; y <= h - RULED_BOTTOM; y += STEP) {
      parts.push(
        `<line x1="${RULED_INSET}" y1="${y}" x2="${w - RULED_INSET}" y2="${y}" stroke="${paint.templateLine}" stroke-width="1"/>`,
      );
    }
  } else if (page.template === 'grid') {
    for (let y = STEP; y < h; y += STEP) {
      parts.push(
        `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${paint.templateLine}" stroke-width="1"/>`,
      );
    }
    for (let x = STEP; x < w; x += STEP) {
      parts.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${paint.templateLine}" stroke-width="1"/>`,
      );
    }
  } else if (page.template === 'dotted') {
    for (let y = STEP; y < h; y += STEP) {
      for (let x = STEP; x < w; x += STEP) {
        parts.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="${paint.templateLine}"/>`);
      }
    }
  }
  return parts.join('\n  ');
}

export function buildPageSvg(page: DocPage, paint: ThemePaint, title: string): string {
  const { w, h } = page.size;
  const strokes = page.strokes
    .map((s) => {
      const outline = strokeOutline(s.points, Math.floor(s.points.length / 3), {
        width: s.width,
        tool: s.tool,
        tuning: DEFAULT_TUNING,
      });
      const d = outlineToSvgPath(outline);
      const fill = resolveInk(s.color, paint.dark);
      const opacity =
        s.tool === 'highlighter' ? ` fill-opacity="${HIGHLIGHT_ALPHA_LIGHT}"` : '';
      return `<path d="${d}" fill="${fill}"${opacity}/>`;
    })
    .join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <title>${esc(title)}</title>
  <rect width="${w}" height="${h}" fill="${paint.canvas}"/>
  ${templateSvg(page, paint)}
  ${strokes}
</svg>
`;
}
