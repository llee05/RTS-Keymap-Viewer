import type { KeyboardPreset, Keybind } from './presets.ts';

export type KeyPosition = { rowIndex: number; keyIndex: number };

export function clonePreset(preset: KeyboardPreset): KeyboardPreset {
  return {
    ...preset,
    rows: preset.rows.map((row) => row.map((key) => ({
      ...key,
      hotkeys: [...key.hotkeys],
      combinations: key.combinations?.map((combination) => ({
        ...combination,
        ...(combination.additionalKeyIds ? { additionalKeyIds: [...combination.additionalKeyIds] } : {}),
      })),
    }))),
  };
}

export function createCustomPreset(preset: KeyboardPreset, name = 'Custom Preset'): KeyboardPreset {
  return { ...clonePreset(preset), id: `custom-${crypto.randomUUID()}`, name };
}

export function parseHotkeyText(value: string): string[] {
  const commands = value.split('\n').map((command) => command.trim()).filter(Boolean);
  return commands.length ? commands : [''];
}

export function normalizePreset(preset: KeyboardPreset): KeyboardPreset {
  const normalized = clonePreset(preset);
  normalized.rows.forEach((row) => row.forEach((key) => {
    if (!key.spacer) key.hotkeys = parseHotkeyText(key.hotkeys.join('\n'));
  }));
  return normalized;
}

export function updatePresetKey(
  preset: KeyboardPreset,
  position: KeyPosition,
  update: (key: Keybind) => Keybind,
): KeyboardPreset {
  return {
    ...preset,
    rows: preset.rows.map((row, rowIndex) => rowIndex === position.rowIndex
      ? row.map((key, keyIndex) => keyIndex === position.keyIndex ? update(key) : key)
      : row),
  };
}
