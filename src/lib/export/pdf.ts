// Minimal hand-rolled vector PDF writer: strokes as filled outline polygons.
// ASCII-only output keeps byte offsets equal to string offsets — text goes out
// as hex strings for the same reason.

import {
  DEFAULT_TUNING,
  HIGHLIGHT_ALPHA_DARK,
  HIGHLIGHT_ALPHA_LIGHT,
  resolveInk,
  strokeOutline,
  type ThemePaint,
} from '$lib/ink/engine';
import { PAGE_SIZE, type DocPage } from '$lib/doc/model';
import { planProject, CONTENTS_PER_SHEET } from './plan';

/** Page units are ≈150dpi; PDF points are 72dpi. */
const K = 72 / 150;

const STEP = 44;
const RULED_TOP = 128;
const RULED_BOTTOM = 64;
const RULED_INSET = 48;

function num(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

function rgb(hex: string): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return `${num(r)} ${num(g)} ${num(b)}`;
}

function pageContent(page: DocPage, paint: ThemePaint): string {
  const { w, h } = page.size;
  const out: string[] = [];
  out.push('q');
  // Map page units (y down) onto PDF points (y up).
  out.push(`${num(K)} 0 0 ${num(-K)} 0 ${num(h * K)} cm`);
  out.push(`${rgb(paint.canvas)} rg 0 0 ${num(w)} ${num(h)} re f`);

  if (page.template !== 'blank') {
    out.push(`${rgb(paint.templateLine)} RG ${rgb(paint.templateLine)} rg 1 w`);
    if (page.template === 'ruled') {
      for (let y = RULED_TOP; y <= h - RULED_BOTTOM; y += STEP) {
        out.push(`${num(RULED_INSET)} ${num(y)} m ${num(w - RULED_INSET)} ${num(y)} l S`);
      }
    } else if (page.template === 'grid') {
      for (let y = STEP; y < h; y += STEP) {
        out.push(`0 ${num(y)} m ${num(w)} ${num(y)} l S`);
      }
      for (let x = STEP; x < w; x += STEP) {
        out.push(`${num(x)} 0 m ${num(x)} ${num(h)} l S`);
      }
    } else if (page.template === 'dotted') {
      for (let y = STEP; y < h; y += STEP) {
        for (let x = STEP; x < w; x += STEP) {
          out.push(`${num(x - 1.2)} ${num(y - 1.2)} 2.4 2.4 re f`);
        }
      }
    }
  }

  for (const stroke of page.strokes) {
    const outline = strokeOutline(stroke.points, Math.floor(stroke.points.length / 3), {
      width: stroke.width,
      tool: stroke.tool,
      tuning: DEFAULT_TUNING,
    });
    if (outline.length < 3) continue;
    const highlighter = stroke.tool === 'highlighter';
    if (highlighter) out.push('/Ghl gs');
    out.push(`${rgb(resolveInk(stroke.color, paint.dark))} rg`);
    const path: string[] = [`${num(outline[0][0])} ${num(outline[0][1])} m`];
    for (let i = 1; i < outline.length; i++) {
      path.push(`${num(outline[i][0])} ${num(outline[i][1])} l`);
    }
    path.push('h f');
    out.push(path.join(' '));
    if (highlighter) out.push('/Gn gs');
  }

  out.push('Q');
  return out.join('\n');
}

interface Link {
  /** [x0, y0, x1, y1] in points, y up. */
  rect: [number, number, number, number];
  /** Sheet index the link jumps to. */
  target: number;
}

interface Sheet {
  w: number;
  h: number;
  content: string;
  links: Link[];
}

function inkSheet(page: DocPage, paint: ThemePaint): Sheet {
  return {
    w: page.size.w * K,
    h: page.size.h * K,
    content: pageContent(page, paint),
    links: [],
  };
}

const RESOURCES = '<< /ExtGState << /Ghl 3 0 R /Gn 4 0 R >> /Font << /F1 5 0 R /F2 6 0 R >> >>';

function writePdf(sheets: Sheet[], paint: ThemePaint): Uint8Array {
  const bodies: string[] = [];
  const add = (body: string): number => bodies.push(body); // returns new length = obj number

  // As on screen: multiply on light paper, screen on dark — multiply would vanish there.
  const hlAlpha = paint.dark ? HIGHLIGHT_ALPHA_DARK : HIGHLIGHT_ALPHA_LIGHT;
  const hlBlend = paint.dark ? '/Screen' : '/Multiply';

  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // placeholder for the Pages node (object 2)
  add(`<< /Type /ExtGState /ca ${hlAlpha} /CA 1 /BM ${hlBlend} >>`);
  add('<< /Type /ExtGState /ca 1 /CA 1 /BM /Normal >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');

  const contentObjs = sheets.map((s) =>
    add(`<< /Length ${s.content.length} >>\nstream\n${s.content}\nendstream`),
  );
  // Page objects are reserved first: a link has to name a page that comes later.
  const pageObjs = sheets.map(() => add(''));
  const annotObjs = sheets.map((s) =>
    s.links.map((l) =>
      add(
        `<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(num).join(' ')}] ` +
          `/Border [0 0 0] /Dest [${pageObjs[l.target]} 0 R /Fit] >>`,
      ),
    ),
  );

  sheets.forEach((s, i) => {
    const refs = annotObjs[i].map((o) => `${o} 0 R`).join(' ');
    bodies[pageObjs[i] - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(s.w)} ${num(s.h)}] ` +
      `/Resources ${RESOURCES} /Contents ${contentObjs[i]} 0 R` +
      `${refs ? ` /Annots [${refs}]` : ''} >>`;
  });
  bodies[1] =
    `<< /Type /Pages /Kids [${pageObjs.map((o) => `${o} 0 R`).join(' ')}] ` +
    `/Count ${sheets.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  bodies.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

export function buildPdf(pages: DocPage[], paint: ThemePaint): Uint8Array {
  return writePdf(
    pages.map((page) => inkSheet(page, paint)),
    paint,
  );
}

/** Courier: every glyph is 0.6em, so centring is arithmetic and needs no width table. */
const GLYPH = 0.6;
const MARGIN = 64;
const COVER_SIZE = 30;
const DIVIDER_SIZE = 22;
const ENTRY_SIZE = 11;
const ENTRY_STEP = 22;
const MIN_SIZE = 9;

/** The typographic punctuation a title actually carries; the rest of Latin-1 is 1:1. */
const WIN_ANSI: Record<string, number> = {
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '…': 0x85,
};

function hexText(text: string): string {
  let out = '<';
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.codePointAt(0) ?? 0x3f;
    out += (code <= 0xff ? code : 0x3f).toString(16).padStart(2, '0');
  }
  return `${out}>`;
}

function textWidth(text: string, size: number): number {
  return text.length * GLYPH * size;
}

/** Shrinks to fit, then clips with an ellipsis rather than running off the sheet. */
function fitText(text: string, maxWidth: number, size: number): { text: string; size: number } {
  const fits = maxWidth / (text.length * GLYPH);
  if (fits >= size) return { text, size };
  if (fits >= MIN_SIZE) return { text, size: fits };
  const chars = Math.max(1, Math.floor(maxWidth / (GLYPH * MIN_SIZE)) - 1);
  return { text: `${text.slice(0, chars)}…`, size: MIN_SIZE };
}

function drawText(text: string, x: number, y: number, size: number, bold = false): string {
  const font = bold ? 'F2' : 'F1';
  return `BT /${font} ${num(size)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm ${hexText(text)} Tj ET`;
}

const SHEET_W = PAGE_SIZE.w * K;
const SHEET_H = PAGE_SIZE.h * K;

/** Plain paper and the page's own black ink — the same ink a stroke would use. */
function plainHead(paint: ThemePaint): string[] {
  return [
    `${rgb(paint.canvas)} rg 0 0 ${num(SHEET_W)} ${num(SHEET_H)} re f`,
    `${rgb(resolveInk('ink/black', paint.dark))} rg`,
  ];
}

/** The cover and every notebook's title page: one line, centred on plain paper. */
function centredSheet(title: string, size: number, paint: ThemePaint): Sheet {
  const fitted = fitText(title, SHEET_W - MARGIN * 2, size);
  const x = (SHEET_W - textWidth(fitted.text, fitted.size)) / 2;
  const content = [
    ...plainHead(paint),
    drawText(fitted.text, x, SHEET_H / 2 - fitted.size * 0.35, fitted.size),
  ].join('\n');
  return { w: SHEET_W, h: SHEET_H, content, links: [] };
}

interface Entry {
  title: string;
  /** Printed page number, and the sheet the link jumps to. */
  page: number;
  target: number;
}

function contentsSheets(entries: Entry[], paint: ThemePaint): Sheet[] {
  const sheets: Sheet[] = [];
  const count = Math.max(1, Math.ceil(entries.length / CONTENTS_PER_SHEET));
  for (let i = 0; i < count; i++) {
    const chunk = entries.slice(i * CONTENTS_PER_SHEET, (i + 1) * CONTENTS_PER_SHEET);
    const content = [...plainHead(paint)];
    const links: Link[] = [];
    if (i === 0) content.push(drawText('Contents', MARGIN, SHEET_H - MARGIN, 16, true));
    chunk.forEach((entry, row) => {
      const y = SHEET_H - MARGIN - 44 - row * ENTRY_STEP;
      const number = String(entry.page);
      const numberW = textWidth(number, ENTRY_SIZE);
      const fitted = fitText(entry.title, SHEET_W - MARGIN * 2 - numberW - 16, ENTRY_SIZE);
      content.push(drawText(fitted.text, MARGIN, y, fitted.size));
      content.push(drawText(number, SHEET_W - MARGIN - numberW, y, ENTRY_SIZE));
      // The whole line is the link, not just the words in it.
      links.push({
        rect: [MARGIN, y - 5, SHEET_W - MARGIN, y + ENTRY_SIZE],
        target: entry.target,
      });
    });
    sheets.push({ w: SHEET_W, h: SHEET_H, content: content.join('\n'), links });
  }
  return sheets;
}

export interface ProjectSection {
  title: string;
  pages: DocPage[];
}

/** One document out of a whole project: cover, linked contents, and every notebook
 *  behind a title page of its own. Sections arrive in the order they should read. */
export function buildProjectPdf(
  title: string,
  sections: ProjectSection[],
  paint: ThemePaint,
): Uint8Array {
  const plan = planProject(sections.map((s) => s.pages.length));
  const entries = sections.map((section, i): Entry => ({
    title: section.title,
    page: plan.starts[i] + 1,
    target: plan.starts[i],
  }));

  const sheets: Sheet[] = [
    centredSheet(title, COVER_SIZE, paint),
    ...contentsSheets(entries, paint),
  ];
  for (const section of sections) {
    sheets.push(centredSheet(section.title, DIVIDER_SIZE, paint));
    for (const page of section.pages) sheets.push(inkSheet(page, paint));
  }
  return writePdf(sheets, paint);
}
