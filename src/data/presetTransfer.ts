import type { Keybind, KeyboardPreset, KeyCombination } from './presets.ts';
import { validatePreset } from './presetValidation.ts';
import { createCustomPreset, normalizePreset } from './presetEditing.ts';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  return value;
}

function readKey(value: unknown, field: string): Keybind {
  const data = record(value, field);
  if (!Array.isArray(data.hotkeys)) throw new Error(`${field}.hotkeys must be a command list.`);
  const key: Keybind = {
    label: string(data.label, `${field}.label`),
    hotkeys: data.hotkeys.map((command) => string(command, `${field}.hotkeys`)),
  };
  if (data.spacer !== undefined) {
    if (typeof data.spacer !== 'boolean') throw new Error(`${field}.spacer must be true or false.`);
    key.spacer = data.spacer;
  }
  for (const dimension of ['width', 'height'] as const) {
    if (data[dimension] !== undefined) {
      const size = data[dimension];
      if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0 || size > 30) {
        throw new Error(`${field}.${dimension} must be a positive number no greater than 30.`);
      }
      key[dimension] = size;
    }
  }
  if (data.combinations !== undefined) {
    if (!Array.isArray(data.combinations)) throw new Error(`${field}.combinations must be a list.`);
    key.combinations = data.combinations.map((value) => {
      const combination = record(value, `${field}.combinations`);
      const parsed: KeyCombination = {
        keyId: string(combination.keyId, `${field}.combinations.keyId`),
        action: string(combination.action, `${field}.combinations.action`),
      };
      if (combination.additionalKeyIds !== undefined) {
        if (!Array.isArray(combination.additionalKeyIds)) throw new Error(`${field}.combinations.additionalKeyIds must be a key list.`);
        parsed.additionalKeyIds = combination.additionalKeyIds.map((id) => string(id, `${field}.combinations.additionalKeyIds`));
      }
      return parsed;
    });
  }
  if (key.spacer && key.combinations?.length) throw new Error(`${field}: spacers cannot have combinations.`);
  return key;
}

function readPreset(value: unknown, index: number): KeyboardPreset {
  const field = `Preset ${index + 1}`;
  const data = record(value, field);
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 30) {
    throw new Error(`${field}.rows must contain between 1 and 30 keyboard rows.`);
  }
  const rows = data.rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || !row.length) throw new Error(`${field}, row ${rowIndex + 1} must be a nonempty key list.`);
    return row.map((key, keyIndex) => readKey(key, `${field}, key ${rowIndex}-${keyIndex}`));
  });
  if (rows.flat().length > 500) throw new Error(`${field} cannot contain more than 500 keys.`);
  const preset: KeyboardPreset = {
    id: string(data.id, `${field}.id`),
    name: string(data.name, `${field}.name`),
    game: string(data.game, `${field}.game`),
    rows,
  };
  validatePreset(preset);
  return normalizePreset(preset);
}

export function parsePresetImport(text: string): KeyboardPreset[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Choose a JSON file smaller than 2 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  let values: unknown[];
  if (Array.isArray(parsed)) values = parsed;
  else if (parsed && typeof parsed === 'object' && 'format' in parsed) {
    const backup = record(parsed, 'Backup');
    if (backup.format !== 'rts-keymap-viewer' || backup.version !== 1) throw new Error('This backup format or version is not supported.');
    if (!Array.isArray(backup.presets)) throw new Error('The backup must contain a preset list.');
    values = backup.presets;
  } else values = [parsed];
  if (!values.length || values.length > 100) throw new Error('Import between 1 and 100 presets at a time.');
  return values.map(readPreset).map((preset) => createCustomPreset(preset, preset.name));
}

export function serializePresets(presets: KeyboardPreset[]): string {
  return JSON.stringify({ format: 'rts-keymap-viewer', version: 1, presets }, null, 2);
}
