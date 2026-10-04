import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { clonePreset, normalizePreset } from '../src/data/presetEditing.ts';
import { MAX_IMPORT_BYTES, parsePresetImport, serializePresets } from '../src/data/presetTransfer.ts';
import { deletePreset } from '../src/data/presets.ts';

test('backup round trips commands, combinations, sizing, spacers, and labels as fresh custom copies', () => {
  const source = defaultPresets[0];
  const backup = serializePresets([source]);
  const [imported] = parsePresetImport(backup);
  const [again] = parsePresetImport(backup);
  assert.notEqual(imported.id, source.id);
  assert.notEqual(imported.id, again.id);
  assert.match(imported.id, /^custom-/);
  assert.equal(imported.name, source.name);
  assert.equal(imported.game, source.game);
  assert.deepEqual(imported.rows, normalizePreset(source).rows);
});

test('single presets and arrays can also be imported', () => {
  assert.equal(parsePresetImport(JSON.stringify(defaultPresets[0])).length, 1);
  assert.equal(parsePresetImport(JSON.stringify([defaultPresets[0], defaultPresets[0]])).length, 2);
});

test('unsupported backups, empty arrays, malformed JSON and oversized files are rejected', () => {
  for (const value of [{ format: 'other', version: 1, presets: defaultPresets }, { format: 'rts-keymap-viewer', version: 2, presets: defaultPresets }, []]) {
    assert.throws(() => parsePresetImport(JSON.stringify(value)));
  }
  assert.throws(() => parsePresetImport('{broken'), /valid JSON/);
  assert.throws(() => parsePresetImport(' '.repeat(MAX_IMPORT_BYTES + 1)), /2 MB/);
});

test('import validates data types, dimensions, and combination references before accepting any presets', () => {
  const invalid = clonePreset(defaultPresets[0]);
  invalid.rows[3][1].combinations![0].keyId = '3-1';
  assert.throws(() => parsePresetImport(serializePresets([defaultPresets[0], invalid])), /itself/);
  const badCommand = JSON.parse(JSON.stringify(defaultPresets[0]));
  badCommand.rows[0][0].hotkeys = [123];
  assert.throws(() => parsePresetImport(JSON.stringify(badCommand)), /must be text/);
  invalid.rows[0][0].width = -1;
  assert.throws(() => parsePresetImport(JSON.stringify(invalid)), /positive number/);
});

test('unknown imported fields are discarded and command whitespace is normalized', () => {
  const source = { ...defaultPresets[0], unexpected: 'ignored', rows: [[{ label: 'A', hotkeys: ['  First  ', '', 'Second '], unexpected: 'ignored' }]] };
  const [imported] = parsePresetImport(JSON.stringify(source));
  assert.equal('unexpected' in imported, false);
  assert.equal('unexpected' in imported.rows[0][0], false);
  assert.deepEqual(imported.rows[0][0].hotkeys, ['First', 'Second']);
});

test('bundled presets cannot be deleted even if a caller bypasses the controls', async () => {
  await assert.rejects(deletePreset('aoe4-default'), /cannot be deleted/);
});
