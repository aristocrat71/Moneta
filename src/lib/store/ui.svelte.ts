class UiStore {
  settingsOpen = $state(false);
  aboutOpen = $state(false);
  /** Project id whose header should enter inline-rename (just created). */
  renameProjectId = $state<string | null>(null);
}

export const ui = new UiStore();
