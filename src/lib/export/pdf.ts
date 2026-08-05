// Minimal hand-rolled vector PDF writer: strokes as filled outline polygons.
// ASCII-only output keeps byte offsets equal to string offsets.

import {
  DEFAULT_TUNING,
  HIGHLIGHT_ALPHA_LIGHT,
  resolveInk,
  strokeOutline,
  type ThemePaint,
} from '$lib/ink/engine';
import type { DocPage } from '$lib/doc/model';

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

export function buildPdf(pages: DocPage[], paint: ThemePaint): Uint8Array {
  const bodies: string[] = [];
  const add = (body: string): number => bodies.push(body); // returns new length = obj number

  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // placeholder for the Pages node (object 2)
  add(`<< /Type /ExtGState /ca ${HIGHLIGHT_ALPHA_LIGHT} /CA 1 /BM /Multiply >>`);
  add('<< /Type /ExtGState /ca 1 /CA 1 /BM /Normal >>');

  const kids: string[] = [];
  for (const page of pages) {
    const content = pageContent(page, paint);
    const contentObj = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObj = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.size.w * K)} ${num(
        page.size.h * K,
      )}] /Resources << /ExtGState << /Ghl 3 0 R /Gn 4 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    kids.push(`${pageObj} 0 R`);
  }
  bodies[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

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
