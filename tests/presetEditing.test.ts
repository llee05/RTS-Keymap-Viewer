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

test('command parsing handles Windows line endings and Unicode whitespace without altering command content', () => {
  assert.deepEqual(parseHotkeyText('\tAttack  move\r\n\r\n\u00a0Queue units\u00a0\r\nAttack  move\r\n'), [
    'Attack  move', 'Queue units', 'Attack  move',
  ]);
});

test('normalization is idempotent and preserves combinations, spacers, and layout metadata', () => {
  const draft = { id: 'custom', name: 'Name', game: 'Game', rows: [[
    { label: 'A', hotkeys: [], width: 1.5, height: 2, combinations: [{ keyId: '0-2', action: '  Queue units  ' }] },
    { label: '', hotkeys: ['  Spacer data  '], width: 0.5, spacer: true },
    { label: 'Ctrl', hotkeys: ['\n  First  \nSecond  ', ''] },
  ]] };
  const before = structuredClone(draft);
  const normalized = normalizePreset(draft);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), { ...draft, rows: [[
    { ...draft.rows[0][0], hotkeys: [''] },
    draft.rows[0][1],
    { ...draft.rows[0][2], hotkeys: ['First', 'Second'] },
  ]] });
  assert.deepEqual(normalizePreset(normalized), normalized);
  assert.deepEqual(draft, before);
});

test('custom names and combination edits retain metadata and leave the template unchanged', () => {
  const template = clonePreset(defaultPresets[0]);
  const before = structuredClone(template);
  const custom = createCustomPreset(template, 'My layout');
  assert.equal(custom.name, 'My layout');
  assert.equal(custom.game, template.game);
  const edited = updatePresetKey(custom, { rowIndex: 3, keyIndex: 1 }, (key) => ({
    ...key, combinations: [{ keyId: '5-7', action: 'Custom action' }],
  }));
  assert.deepEqual(edited.rows[3][1].combinations, [{ keyId: '5-7', action: 'Custom action' }]);
  assert.deepEqual(edited.rows[3][1].hotkeys, template.rows[3][1].hotkeys);
  assert.deepEqual(custom.rows, template.rows);
  assert.deepEqual(template, before);
});
