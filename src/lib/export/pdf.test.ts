import { describe, expect, test } from 'vitest';
import type { ThemePaint } from '$lib/ink/engine';
import { PAGE_SIZE, type DocPage } from '$lib/doc/model';
import { buildPdf, buildProjectPdf } from './pdf';

const PAINT: ThemePaint = {
  dark: false,
  canvas: '#fcfbf8',
  templateLine: '#e4e1d8',
  accent: '#3e5c8a',
};

function page(): DocPage {
  return { id: 'p', template: 'dotted', size: { ...PAGE_SIZE }, strokes: [] };
}

const text = (pdf: Uint8Array) => new TextDecoder('latin1').decode(pdf);

/** Every xref entry must land exactly on its object header, or readers give up. */
function xrefIsSound(pdf: string): boolean {
  const start = Number(pdf.slice(pdf.lastIndexOf('startxref')).split('\n')[1]);
  const rows = pdf
    .slice(start)
    .split('\n')
    .filter((l) => / 00000 n $/.test(l));
  return rows.every((row, i) => pdf.startsWith(`${i + 1} 0 obj`, Number(row.slice(0, 10))));
}

describe('buildPdf', () => {
  test('one object header per xref entry', () => {
    expect(xrefIsSound(text(buildPdf([page(), page()], PAINT)))).toBe(true);
  });

  test('carries a page per sheet', () => {
    expect(text(buildPdf([page(), page()], PAINT))).toContain('/Count 2');
  });
});

describe('buildProjectPdf', () => {
  const sections = [
    { title: 'Alpha', pages: [page(), page()] },
    { title: 'Beta', pages: [page()] },
  ];
  const pdf = text(buildProjectPdf('Field notes', sections, PAINT));

  test('cover and contents ride in front of the notebooks', () => {
    // 1 cover + 1 contents + (1 title + 2) + (1 title + 1)
    expect(pdf).toContain('/Count 7');
    expect(xrefIsSound(pdf)).toBe(true);
  });

  test('every contents line links to a real page', () => {
    const annots = [...pdf.matchAll(/\/Subtype \/Link .*?\/Dest \[(\d+) 0 R \/Fit\]/g)];
    expect(annots).toHaveLength(sections.length);
    for (const [, obj] of annots) {
      const body = pdf.slice(pdf.indexOf(`\n${obj} 0 obj`));
      expect(body).toContain('/Type /Page');
    }
  });

  test('titles are written as text, not drawn as ink', () => {
    const hex = (s: string) =>
      [...s].map((c) => (c.codePointAt(0) ?? 0).toString(16).padStart(2, '0')).join('');
    expect(pdf).toContain(`<${hex('Field notes')}> Tj`);
    expect(pdf).toContain(`<${hex('Alpha')}> Tj`);
    expect(pdf).toContain(`<${hex('Contents')}> Tj`);
  });
});
