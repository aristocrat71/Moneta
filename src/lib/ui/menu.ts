import type { Component } from 'svelte';

export interface MenuItem {
  label: string;
  icon?: Component<{ size?: number | string; strokeWidth?: number | string }>;
  danger?: boolean;
  disabled?: boolean;
  /** Set (either way) to give the item a tick column — for choices, not actions. */
  checked?: boolean;
  /** Hairline above this item, splitting one run of choices from the next. */
  divider?: boolean;
  /** Opens a nested list instead of running an action. */
  children?: MenuItem[];
  action?: () => void;
}
