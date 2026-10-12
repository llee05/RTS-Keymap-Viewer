import type { KeyboardPreset } from './presets.ts';
import { readPreset } from './presetTransfer.ts';

const ACTIVE = 'rts-keymap-active';
const DRAFT = 'rts-keymap-draft';
export type RecoveredDraft = { preset: KeyboardPreset; activePresetId: string };

export function readActivePreset(): string | null {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}

export function rememberActivePreset(id: string): void {
  try { localStorage.setItem(ACTIVE, id); } catch { /* Selection is optional when browser storage is unavailable. */ }
}

export function readRecoveredDraft(): RecoveredDraft | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRAFT) ?? 'null');
    if (!value || typeof value !== 'object' || !('preset' in value) || !('activePresetId' in value) || typeof value.activePresetId !== 'string') return null;
    return { preset: readPreset(value.preset, 0, false), activePresetId: value.activePresetId };
  } catch { return null; }
}

export function rememberDraft(value: RecoveredDraft | null): boolean {
  try {
    if (value) localStorage.setItem(DRAFT, JSON.stringify(value));
    else localStorage.removeItem(DRAFT);
    return true;
  } catch { return false; }
}
