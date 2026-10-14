export const themes = [
  { id: 'midnight', name: 'Midnight' },
  { id: 'forest', name: 'Forest' },
  { id: 'ember', name: 'Ember' },
] as const;

export type Theme = typeof themes[number]['id'];
const STORAGE_KEY = 'rts-keymap-theme';

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return themes.find((theme) => theme.id === saved)?.id ?? 'midnight';
  } catch { return 'midnight'; }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function rememberTheme(theme: Theme): void {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* The theme still works for this session. */ }
}
