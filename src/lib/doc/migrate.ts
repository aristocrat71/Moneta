// Format migrations. Each entry is a pure v(n) → v(n+1) function; loading
// always migrates forward and never writes back until the user saves.

import { FORMAT_VERSION, PAGE_SIZE } from './model';
import type { DocPage, NotebookDoc } from './model';
import type { StrokeData, TemplateKind } from '$lib/ink/engine';

type RawDoc = Record<string, unknown>;

export const MIGRATIONS: Record<number, (doc: RawDoc) => RawDoc> = {
  // v1 is current — future entries look like:
  // 1: (doc) => ({ ...doc, formatVersion: 2, ... }),
};

export class MigrationError extends Error {}

const TEMPLATES: TemplateKind[] = ['blank', 'ruled', 'grid', 'dotted'];

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeStroke(raw: unknown): StrokeData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as RawDoc;
  let points: number[] = [];
  if (Array.isArray(s.points)) {
    // Stored flat, but accept nested [[x,y,p], ...] defensively.
    if (s.points.length > 0 && Array.isArray(s.points[0])) {
      points = (s.points as number[][]).flat();
    } else {
      points = (s.points as unknown[]).filter((v): v is number => typeof v === 'number');
    }
  }
  points = points.slice(0, points.length - (points.length % 3));
  if (points.length === 0) return null;
  return {
    id: typeof s.id === 'string' ? s.id : crypto.randomUUID(),
    tool: s.tool === 'highlighter' || s.tool === 'shape' ? s.tool : 'pen',
    color: typeof s.color === 'string' ? s.color : 'ink/black',
    width: Math.max(0.5, asNumber(s.width, 3)),
    points,
  };
}

function normalizePage(raw: unknown): DocPage {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as RawDoc;
  const size = (typeof p.size === 'object' && p.size !== null ? p.size : {}) as RawDoc;
  const strokes = Array.isArray(p.strokes)
    ? p.strokes.map(normalizeStroke).filter((s): s is StrokeData => s !== null)
    : [];
  return {
    id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
    template: TEMPLATES.includes(p.template as TemplateKind)
      ? (p.template as TemplateKind)
      : 'blank',
    size: {
      w: asNumber(size.w, PAGE_SIZE.w),
      h: asNumber(size.h, PAGE_SIZE.h),
    },
    strokes,
  };
}

/** Migrate a parsed .moneta JSON value forward and normalize every field. */
export function migrateNotebook(raw: unknown): NotebookDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new MigrationError('not a notebook file');
  }
  let doc = raw as RawDoc;
  let version = asNumber(doc.formatVersion, 1);
  if (version > FORMAT_VERSION) {
    throw new MigrationError(
      `notebook was written by a newer Moneta (format v${version}, supported v${FORMAT_VERSION})`,
    );
  }
  while (version < FORMAT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new MigrationError(`no migration from format v${version}`);
    doc = step(doc);
    version++;
  }

  const pages = Array.isArray(doc.pages) && doc.pages.length > 0 ? doc.pages : [{}];
  const normalizedPages = pages.map(normalizePage);
  const lastOpen = asNumber(doc.lastOpenPage, 0);
  return {
    formatVersion: FORMAT_VERSION,
    id: typeof doc.id === 'string' ? doc.id : crypto.randomUUID(),
    title: typeof doc.title === 'string' && doc.title.length > 0 ? doc.title : 'Untitled',
    projectId: typeof doc.projectId === 'string' ? doc.projectId : null,
    createdAt: asNumber(doc.createdAt, Date.now()),
    modifiedAt: asNumber(doc.modifiedAt, Date.now()),
    lastOpenPage: Math.min(Math.max(0, Math.floor(lastOpen)), normalizedPages.length - 1),
    pages: normalizedPages,
  };
}
