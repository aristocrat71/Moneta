// Export orchestration. Files land in ~/Moneta/exports; rendering always
// uses light-paper (DESIGN.md §5.6).

import { ipc } from '$lib/ipc';
import { DEFAULT_TUNING, renderPageBitmap } from '$lib/ink/engine';
import { getThemePaint } from '$lib/ui/theme-paint';
import type { NotebookDoc } from '$lib/doc/model';
import { buildPdf } from './pdf';
import { buildPageSvg } from './svg';
import { resolveRange, rangeSuffix, type PageRange } from './range';

export type ExportKind = 'pdf' | 'png' | 'svg';

export { resolveRange, rangeSuffix, type PageRange };

function b64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64FromText(text: string): string {
  return b64FromBytes(new TextEncoder().encode(text));
}

function safeName(title: string): string {
  const cleaned = title.replace(/[/\\:]/g, '-').trim();
  return cleaned.length > 0 ? cleaned : 'Untitled';
}

/**
 * Returns the written path (pdf) or the export folder (png/svg). `range` is
 * inclusive and 1-based; omitting it exports the whole notebook. Pages keep
 * their own numbers in png/svg filenames — page 4 is `p4.png` whether or not
 * the export started at page 1.
 */
export async function exportNotebook(
  doc: NotebookDoc,
  kind: ExportKind,
  range?: PageRange | null,
): Promise<string> {
  const paint = getThemePaint(false);
  const span = resolveRange(doc.pages.length, range);
  const pages = doc.pages.slice(span.from - 1, span.to);
  const name = safeName(doc.title) + rangeSuffix(span, doc.pages.length);

  if (kind === 'pdf') {
    return ipc.exportFile(`${name}.pdf`, b64FromBytes(buildPdf(pages, paint)));
  }

  let lastPath = '';
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const num = span.from + i;
    if (kind === 'svg') {
      const svg = buildPageSvg(page, paint, `${doc.title} — page ${num}`);
      lastPath = await ipc.exportFile(`${name}/p${num}.svg`, b64FromText(svg));
    } else {
      const canvas = renderPageBitmap({
        strokes: page.strokes,
        template: page.template,
        size: page.size,
        paint,
        tuning: DEFAULT_TUNING,
        width: page.size.w * 2,
      });
      const data = canvas.toDataURL('image/png').split(',')[1];
      lastPath = await ipc.exportFile(`${name}/p${num}.png`, data);
    }
  }
  return lastPath.slice(0, lastPath.lastIndexOf('/'));
}
