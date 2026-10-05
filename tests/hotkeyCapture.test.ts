import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { assignRecordedHotkey, findRecordedCombination, getKeyForCode } from '../src/data/hotkeyCapture.ts';
import { clonePreset, normalizePreset } from '../src/data/presetEditing.ts';
import { findMatchingKeys, getRelatedKeyIds } from '../src/data/keyboard.ts';
import { getPresetValidationErrors } from '../src/data/presetValidation.ts';
import { parsePresetImport, serializePresets } from '../src/data/presetTransfer.ts';

test('physical codes match letters, punctuation, function keys, arrows, and sided modifiers', () => {
  const expected = {
    KeyQ: '2-1', Digit1: '1-1', Backquote: '1-0', Semicolon: '3-10',
    Quote: '3-11', Backslash: '2-13', Equal: '1-12', F1: '0-2', Escape: '0-0',
    ArrowLeft: '6-1', ArrowUp: '5-6', CapsLock: '3-0', Space: '5-4',
    ControlLeft: '5-0', ControlRight: '5-7', ShiftLeft: '4-0', ShiftRight: '4-11',
    AltLeft: '5-3', AltRight: '5-5', MetaLeft: '5-2',
  };
  for (const [code, id] of Object.entries(expected)) assert.equal(getKeyForCode(defaultPresets[0], code)?.id, id, code);
  for (const code of ['', 'Unidentified', 'Numpad1', 'Delete', 'IntlBackslash']) {
    assert.equal(getKeyForCode(defaultPresets[0], code), undefined, code);
  }
});

test('matching works with reordered, explicitly sided, and generic custom labels and excludes spacers', () => {
  const preset = { id: 'custom', name: 'Custom', game: 'Test', rows: [[
    { label: 'Right Control', hotkeys: [''] },
    { label: 'Left Control', hotkeys: [''] },
    { label: 'Option', hotkeys: [''] },
    { label: 'A', hotkeys: [''], spacer: true },
    { label: 'A', hotkeys: [''] },
    { label: 'Numpad1', hotkeys: [''] },
  ]] };
  assert.equal(getKeyForCode(preset, 'ControlRight')?.id, '0-0');
  assert.equal(getKeyForCode(preset, 'ControlLeft')?.id, '0-1');
  assert.equal(getKeyForCode(preset, 'AltRight')?.id, '0-2');
  assert.equal(getKeyForCode(preset, 'KeyA')?.id, '0-4');
  assert.equal(getKeyForCode(preset, 'Numpad1')?.id, '0-5');
  preset.rows[0].push({ label: 'A', hotkeys: [''] });
  assert.equal(getKeyForCode(preset, 'KeyA'), undefined);
});

test('recorded single keys append commands, avoid duplicates, and leave the saved preset unchanged', () => {
  const saved = clonePreset(defaultPresets[0]);
  const before = structuredClone(saved);
  const updated = assignRecordedHotkey(saved, ['2-1'], '  Train scout  ');
  assert.deepEqual(updated.rows[2][1].hotkeys, ['Scout', 'Train scout']);
  assert.deepEqual(assignRecordedHotkey(updated, ['2-1'], 'Train scout').rows, updated.rows);
  assert.deepEqual(assignRecordedHotkey(saved, ['2-4'], ' Rally ').rows[2][4].hotkeys, ['Rally']);
  assert.deepEqual(saved, before);
});

test('recorded combinations retain every key and are searchable and highlighted from any participant', () => {
  const updated = assignRecordedHotkey(defaultPresets[0], ['5-7', '4-0', '2-4'], 'Queue reinforcements');
  assert.deepEqual(updated.rows[2][4].combinations, [{ keyId: '5-7', additionalKeyIds: ['4-0'], action: 'Queue reinforcements' }]);
  assert.deepEqual(getPresetValidationErrors(updated), []);
  assert.deepEqual([...findMatchingKeys(updated, 'queue reinforcements')].sort(), ['2-4', '4-0', '5-7']);
  for (const id of ['2-4', '4-0', '5-7']) {
    const related = getRelatedKeyIds(updated, id);
    assert.ok(['2-4', '4-0', '5-7'].every((keyId) => related.has(keyId)));
  }
  const draft = clonePreset(updated);
  draft.rows[2][4].combinations![0].additionalKeyIds![0] = '4-11';
  assert.deepEqual(updated.rows[2][4].combinations![0].additionalKeyIds, ['4-0']);
});

test('existing combinations are detected across owners and key order and updated without duplicates', () => {
  const saved = clonePreset(defaultPresets[0]);
  const before = structuredClone(saved);
  const match = findRecordedCombination(saved, ['5-5', '1-1']);
  assert.equal(match?.action, 'Ability panel 1');
  const updated = assignRecordedHotkey(saved, ['5-5', '1-1'], 'Updated ability');
  assert.equal(updated.rows[5][5].combinations![0].action, 'Updated ability');
  assert.equal(updated.rows[1][1].combinations, undefined);
  assert.deepEqual(saved, before);
});

test('invalid recordings cannot assign a missing, spacer, duplicate, or empty key', () => {
  for (const ids of [[], ['99-0'], ['6-0'], ['2-1', '2-1']]) {
    assert.throws(() => assignRecordedHotkey(defaultPresets[0], ids, 'Command'), /record keys/);
  }
  assert.throws(() => assignRecordedHotkey(defaultPresets[0], ['2-1'], '  '), /Enter a command/);
});

test('multi-key combinations survive backups and validate every target and complete target sets', () => {
  const source = assignRecordedHotkey(defaultPresets[0], ['5-0', '4-0', '2-1'], 'Queue scout');
  const updated = assignRecordedHotkey(source, ['5-0', '2-1'], 'Select scout');
  const [imported] = parsePresetImport(serializePresets([updated]));
  assert.deepEqual(imported.rows, normalizePreset(updated).rows);
  for (const [target, error] of [['99-0', /does not exist/], ['6-0', /spacer/], ['2-1', /itself/], ['5-0', /repeated/]] as const) {
    const invalid = clonePreset(source);
    invalid.rows[2][1].combinations![0].additionalKeyIds = [target];
    assert.throws(() => parsePresetImport(serializePresets([invalid])), error);
  }
  const duplicate = clonePreset(source);
  duplicate.rows[2][1].combinations!.push({ keyId: '4-0', additionalKeyIds: ['5-0'], action: 'Duplicate chord' });
  assert.match(getPresetValidationErrors(duplicate)[0], /repeated/);
  for (const value of [null, '5-0', [123]]) {
    const invalid = JSON.parse(serializePresets([source]));
    invalid.presets[0].rows[2][1].combinations[0].additionalKeyIds = value;
    assert.throws(() => parsePresetImport(JSON.stringify(invalid)), /key list|must be text/);
  }
  assert.deepEqual(source.rows[2][1].combinations![0].additionalKeyIds, ['4-0']);
});
