import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { clonePreset, createCustomPreset, normalizePreset, parseHotkeyText, updatePresetKey } from '../src/data/presetEditing.ts';

test('a draft does not share nested command or combination data with the saved preset', () => {
  const saved = clonePreset(defaultPresets[0]);
  const before = clonePreset(saved);
  const draft = clonePreset(saved);
  draft.rows[3][1].hotkeys[0] = 'Draft command';
  draft.rows[3][1].combinations![0].action = 'Draft combination';
  assert.deepEqual(saved, before);
});

test('normalization retains raw draft text for retry after a failed save', () => {
  const draft = clonePreset(defaultPresets[0]);
  draft.rows[3][1].hotkeys = ['  Attack move  ', '', '  Queue units '];
  const normalized = normalizePreset(draft);
  assert.deepEqual(normalized.rows[3][1].hotkeys, ['Attack move', 'Queue units']);
  assert.deepEqual(draft.rows[3][1].hotkeys, ['  Attack move  ', '', '  Queue units ']);
  assert.deepEqual(parseHotkeyText(' \n  \n'), ['']);
});

test('custom copies receive distinct IDs and preserve combination positions', () => {
  const first = createCustomPreset(defaultPresets[0]);
  const second = createCustomPreset(defaultPresets[0]);
  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^custom-/);
  assert.equal(first.rows[3][1].combinations![0].keyId, '5-0');
  assert.notEqual(first.rows[3][1].combinations, defaultPresets[0].rows[3][1].combinations);
});

test('changing a selected key preserves other commands and the saved preset', () => {
  const saved = clonePreset(defaultPresets[0]);
  const before = clonePreset(saved);
  const updated = updatePresetKey(saved, { rowIndex: 3, keyIndex: 1 }, (key) => ({ ...key, hotkeys: ['New command'] }));
  assert.deepEqual(saved, before);
  assert.deepEqual(updated.rows[3][1].hotkeys, ['New command']);
  assert.deepEqual(updated.rows[3][2], saved.rows[3][2]);
});
