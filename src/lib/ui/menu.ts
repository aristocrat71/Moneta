import type { Component } from 'svelte';

export interface MenuItem {
  label: string;
  icon?: Component<{ size?: number | string; strokeWidth?: number | string }>;
  danger?: boolean;
  disabled?: boolean;
  /** Opens a nested list instead of running an action. */
  children?: MenuItem[];
  action?: () => void;
}
