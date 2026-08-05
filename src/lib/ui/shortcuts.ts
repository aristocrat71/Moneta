// What the keyboard can do, per screen. Every entry below has a live handler.

export interface Shortcut {
  /** Chords, rendered as separate keycaps: ['⌘N'] or ['↑', '↓']. */
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

export const LIBRARY_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Library',
    items: [
      { keys: ['⌘K'], label: 'Search notebooks' },
      { keys: ['⌘N'], label: 'New notebook' },
      { keys: ['⌘/'], label: 'Keyboard shortcuts' },
      { keys: ['⌘,'], label: 'Settings' },
    ],
  },
];

export const CANVAS_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Tools',
    items: [
      { keys: ['1'], label: 'Pen' },
      { keys: ['2'], label: 'Shapes' },
      { keys: ['2', '1'], label: 'Line' },
      { keys: ['2', '2'], label: 'Square' },
      { keys: ['2', '3'], label: 'Circle' },
      { keys: ['2', '4'], label: 'Triangle' },
      { keys: ['3'], label: 'Eraser' },
      { keys: ['4'], label: 'Highlighter' },
      { keys: ['5'], label: 'Lasso select' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: ['⌘Z'], label: 'Undo' },
      { keys: ['⇧⌘Z'], label: 'Redo' },
      { keys: ['⌫', '⌦'], label: 'Delete the selection' },
      { keys: ['Esc'], label: 'Drop the selection, close what is open' },
    ],
  },
  {
    title: 'The page',
    items: [
      { keys: ['⌘+', '⌘−'], label: 'Zoom in · out' },
      { keys: ['⌘0'], label: 'Fit the page to the window' },
      { keys: ['Space'], label: 'Hold and drag to pan (or drag with the middle button)' },
      { keys: ['⌘'], label: 'Hold and scroll to zoom' },
    ],
  },
  {
    title: 'Glass',
    items: [
      { keys: ['G', 'G'], label: 'Glass paper on · off' },
      { keys: ['J', 'J'], label: 'Click through to the window behind' },
      { keys: ['Esc'], label: 'Take the pointer back' },
    ],
  },
  {
    title: 'App',
    items: [
      { keys: ['⌘/'], label: 'Keyboard shortcuts' },
      { keys: ['⌘,'], label: 'Settings' },
    ],
  },
];
