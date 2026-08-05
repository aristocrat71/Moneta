// The curated ink palette. Strokes store semantic ids ("ink/black") so black ink
// renders bone-white on dark pages; custom hex colors render as-is on both.

export interface InkDef {
  id: string;
  name: string;
  light: string;
  dark: string;
}

export const INKS: InkDef[] = [
  { id: 'ink/black', name: 'Black', light: '#1d1c1a', dark: '#e9e7e1' },
  { id: 'ink/graphite', name: 'Graphite', light: '#57544e', dark: '#aeaba4' },
  { id: 'ink/gall', name: 'Gall blue', light: '#3e5c8a', dark: '#8aa6d6' },
  { id: 'ink/teal', name: 'Teal', light: '#2f6d68', dark: '#6fb3ac' },
  { id: 'ink/sepia', name: 'Sepia', light: '#6b4a2f', dark: '#c09a6f' },
  { id: 'ink/red', name: 'Vermilion', light: '#a8442f', dark: '#d98873' },
  { id: 'ink/green', name: 'Green', light: '#3f6b3f', dark: '#8fbf8f' },
  { id: 'ink/amber', name: 'Amber', light: '#b9862c', dark: '#d9b25f' },
  { id: 'ink/violet', name: 'Violet', light: '#5c4a8a', dark: '#a492d6' },
  { id: 'ink/rose', name: 'Rose', light: '#a84a6b', dark: '#d687a6' },
  { id: 'ink/orange', name: 'Orange', light: '#b45e2a', dark: '#de9a64' },
  { id: 'ink/olive', name: 'Olive', light: '#70702f', dark: '#b5b56a' },
];

const INK_MAP = new Map(INKS.map((ink) => [ink.id, ink]));

export function resolveInk(color: string, dark: boolean): string {
  const ink = INK_MAP.get(color);
  if (ink) return dark ? ink.dark : ink.light;
  return color;
}

export function isSemanticInk(color: string): boolean {
  return INK_MAP.has(color);
}
