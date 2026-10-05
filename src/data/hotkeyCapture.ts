import type { KeyboardPreset } from './presets.ts';
import { getCombinationTargets, getKeyId, getKeyOptions, type KeyOption } from './keyboard.ts';
import { updatePresetKey, type KeyPosition } from './presetEditing.ts';

const codeLabels: Record<string, string[]> = {
  Escape: ['Esc', 'Escape'], Backquote: ['`'], Minus: ['-'], Equal: ['='],
  BracketLeft: ['['], BracketRight: [']'], Backslash: ['\\'], Semicolon: [';'],
  Quote: ["'"], Comma: [','], Period: ['.'], Slash: ['/'],
  Space: ['Space', 'Spacebar'], CapsLock: ['Caps Lock', 'CapsLock'],
  ArrowUp: ['↑', 'Up', 'ArrowUp'], ArrowDown: ['↓', 'Down', 'ArrowDown'],
  ArrowLeft: ['←', 'Left', 'ArrowLeft'], ArrowRight: ['→', 'Right', 'ArrowRight'],
  Control: ['Ctrl', 'Control'], Shift: ['Shift'], Alt: ['Alt', 'Option'],
  Meta: ['Super', 'Meta', 'Win', 'Windows', 'Cmd', 'Command', '⌘'],
};

// Match physical key codes to the displayed layout, including sided modifiers.
export function getKeyForCode(preset: KeyboardPreset, code: string): KeyOption | undefined {
  if (!code || code === 'Unidentified') return undefined;
  const modifier = /^(Control|Shift|Alt|Meta)(Left|Right)$/.exec(code);
  const name = modifier?.[1] ?? code;
  const aliases = codeLabels[name] ?? [/^(Key[A-Z]|Digit[0-9])$/.test(code) ? code.replace(/^(Key|Digit)/, '') : code];
  const options = getKeyOptions(preset);
  const matches = (label: string, candidates: string[]) => candidates.some((candidate) => label.toLowerCase() === candidate.toLowerCase());
  if (modifier) {
    const sided = options.filter((option) => matches(option.label, aliases.map((alias) => `${modifier[2]} ${alias}`)));
    if (sided.length === 1) return sided[0];
  }
  const candidates = options.filter((option) => matches(option.label, [...aliases, code]));
  return candidates.length === 1 ? candidates[0] : undefined;
}

type Assignment = { position: KeyPosition; index: number; action: string };
const signature = (ids: string[]) => [...ids].sort().join(',');

export function findRecordedCombination(preset: KeyboardPreset, keyIds: string[]): Assignment | undefined {
  if (keyIds.length < 2) return undefined;
  const wanted = signature(keyIds);
  for (const [rowIndex, row] of preset.rows.entries()) {
    for (const [keyIndex, key] of row.entries()) {
      if (key.spacer) continue;
      const index = key.combinations?.findIndex((combination) =>
        signature([getKeyId(rowIndex, keyIndex), ...getCombinationTargets(combination)]) === wanted,
      ) ?? -1;
      if (index >= 0) return { position: { rowIndex, keyIndex }, index, action: key.combinations![index].action };
    }
  }
}

export function assignRecordedHotkey(preset: KeyboardPreset, keyIds: string[], command: string): KeyboardPreset {
  const action = command.trim();
  const validIds = new Set(getKeyOptions(preset).map((option) => option.id));
  if (!action || !keyIds.length || new Set(keyIds).size !== keyIds.length || keyIds.some((id) => !validIds.has(id))) {
    throw new Error('Enter a command and record keys from this layout.');
  }
  const existing = findRecordedCombination(preset, keyIds);
  if (existing) {
    return updatePresetKey(preset, existing.position, (key) => ({
      ...key,
      combinations: key.combinations?.map((combination, index) => index === existing.index ? { ...combination, action } : combination),
    }));
  }
  const [rowIndex, keyIndex] = keyIds.at(-1)!.split('-').map(Number);
  return updatePresetKey(preset, { rowIndex, keyIndex }, (key) => {
    if (keyIds.length === 1) {
      const commands = key.hotkeys.map((value) => value.trim()).filter(Boolean);
      return { ...key, hotkeys: commands.includes(action) ? commands : [...commands, action] };
    }
    const targets = keyIds.slice(0, -1);
    return {
      ...key,
      combinations: [...(key.combinations ?? []), {
        keyId: targets[0],
        ...(targets.length > 1 ? { additionalKeyIds: targets.slice(1) } : {}),
        action,
      }],
    };
  });
}
