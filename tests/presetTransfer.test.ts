import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { clonePreset, normalizePreset } from '../src/data/presetEditing.ts';
import { MAX_IMPORT_BYTES, parsePresetImport, serializePresets } from '../src/data/presetTransfer.ts';
import { deletePreset, type KeyboardPreset } from '../src/data/presets.ts';

function minimalPreset(): KeyboardPreset {
  return { id: 'custom-import', name: 'Import preset', game: 'Test', rows: [[{ label: 'A', hotkeys: ['Command'] }]] };
}

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

test('non-object presets and missing or non-text metadata are rejected', () => {
  for (const value of [null, false, 42, 'preset', [null]]) {
    assert.throws(() => parsePresetImport(JSON.stringify(value)), /must be an object/);
  }
  for (const field of ['id', 'name', 'game']) {
    for (const value of [undefined, null, 123, {}]) {
      assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), [field]: value })), new RegExp(`${field} must be text`));
    }
  }
});

test('backup envelopes require a preset array and reject unsupported version types', () => {
  for (const presets of [undefined, null, {}, 'presets']) {
    assert.throws(() => parsePresetImport(JSON.stringify({ format: 'rts-keymap-viewer', version: 1, presets })), /preset list/);
  }
  for (const version of [undefined, null, '1', true]) {
    assert.throws(() => parsePresetImport(JSON.stringify({ format: 'rts-keymap-viewer', version, presets: [minimalPreset()] })), /not supported/);
  }
});

test('keyboard rows and entries must have the documented structure', () => {
  for (const rows of [undefined, null, {}, 'rows', []]) {
    assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows })), /between 1 and 30/);
  }
  for (const row of [null, {}, 'row', []]) {
    assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: [row] })), /nonempty key list/);
  }
  for (const key of [null, [], 'key']) {
    assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: [[key]] })), /key 0-0 must be an object/);
  }
});

test('key labels, commands, spacer flags, and combination fields are type checked', () => {
  const invalidKeys: [unknown, RegExp][] = [
    [{ label: 1, hotkeys: [''] }, /label must be text/],
    [{ label: 'A' }, /command list/],
    [{ label: 'A', hotkeys: 'Command' }, /command list/],
    [{ label: 'A', hotkeys: [null] }, /hotkeys must be text/],
    [{ label: 'A', hotkeys: [''], spacer: 'true' }, /spacer must be true or false/],
    [{ label: 'A', hotkeys: [''], combinations: {} }, /combinations must be a list/],
    [{ label: 'A', hotkeys: [''], combinations: [null] }, /combinations must be an object/],
    [{ label: 'A', hotkeys: [''], combinations: [{ keyId: 1, action: 'Action' }] }, /keyId must be text/],
    [{ label: 'A', hotkeys: [''], combinations: [{ keyId: '0-0', action: false }] }, /action must be text/],
  ];
  for (const [key, message] of invalidKeys) {
    assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: [[key]] })), message);
  }
});

test('both dimensions reject invalid sizes, including numeric overflow in otherwise valid JSON', () => {
  for (const dimension of ['width', 'height']) {
    for (const value of [0, -1, 30.01, null, true, '1']) {
      const preset = minimalPreset();
      const key = { ...preset.rows[0][0], [dimension]: value };
      assert.throws(() => parsePresetImport(JSON.stringify({ ...preset, rows: [[key]] })), /positive number no greater than 30/);
    }
    const text = JSON.stringify({ ...minimalPreset(), rows: [[{ label: 'A', hotkeys: [''], [dimension]: 'overflow' }]] });
    assert.throws(() => parsePresetImport(text.replace('"overflow"', '1e309')), /positive number/);
  }
  const [preset] = parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: [[{ label: 'A', hotkeys: [], width: 0.5, height: 1.5, spacer: false }]] }));
  assert.equal(preset.rows[0][0].width, 0.5);
  assert.equal(preset.rows[0][0].height, 1.5);
  assert.equal(preset.rows[0][0].spacer, false);
  assert.deepEqual(preset.rows[0][0].hotkeys, ['']);
});

test('imports accept the maximum row, key, dimension, and preset counts', () => {
  const preset = minimalPreset();
  preset.rows = Array.from({ length: 30 }, (_, rowIndex) => Array.from({ length: rowIndex === 0 ? 36 : 16 }, () => ({
    label: 'A', hotkeys: [''], width: 30, height: 30,
  })));
  const [imported] = parsePresetImport(JSON.stringify(preset));
  assert.equal(imported.rows.length, 30);
  assert.equal(imported.rows.flat().length, 500);
  assert.equal(imported.rows[0][0].width, 30);
  assert.equal(imported.rows[0][0].height, 30);
  const copies = parsePresetImport(JSON.stringify(Array.from({ length: 100 }, minimalPreset)));
  assert.equal(copies.length, 100);
  assert.equal(new Set(copies.map((copy) => copy.id)).size, 100);
});

test('imports reject counts just beyond the row, key, and batch limits', () => {
  assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: Array.from({ length: 31 }, () => minimalPreset().rows[0]) })), /between 1 and 30/);
  assert.throws(() => parsePresetImport(JSON.stringify({ ...minimalPreset(), rows: [Array.from({ length: 501 }, () => minimalPreset().rows[0][0])] })), /more than 500 keys/);
  assert.throws(() => parsePresetImport(JSON.stringify(Array.from({ length: 101 }, minimalPreset))), /between 1 and 100/);
});

test('the file size limit accepts exactly 2 MiB and counts UTF-8 bytes rather than characters', () => {
  const source = JSON.stringify(minimalPreset());
  const padded = source + ' '.repeat(MAX_IMPORT_BYTES - new TextEncoder().encode(source).length);
  assert.equal(new TextEncoder().encode(padded).length, MAX_IMPORT_BYTES);
  assert.equal(parsePresetImport(padded).length, 1);
  assert.throws(() => parsePresetImport(padded + ' '), /2 MB/);
  const unicode = minimalPreset();
  unicode.rows[0][0].hotkeys = ['🦉'.repeat(MAX_IMPORT_BYTES / 4)];
  const text = JSON.stringify(unicode);
  assert.ok(text.length < MAX_IMPORT_BYTES);
  assert.ok(new TextEncoder().encode(text).length > MAX_IMPORT_BYTES);
  assert.throws(() => parsePresetImport(text), /2 MB/);
});

test('import checks missing, noncanonical, spacer, self, and duplicate combination targets', () => {
  const preset = minimalPreset();
  preset.rows[0].push({ label: 'Ctrl', hotkeys: [''] }, { label: '', hotkeys: [''], spacer: true });
  const targets: [string[], RegExp][] = [
    [['9-9'], /does not exist/],
    [['00-1'], /does not exist/],
    [['0-2'], /spacer/],
    [['0-0'], /itself/],
    [['0-1', '0-1'], /repeated/],
  ];
  for (const [keyIds, message] of targets) {
    preset.rows[0][0].combinations = keyIds.map((keyId) => ({ keyId, action: 'Action' }));
    assert.throws(() => parsePresetImport(JSON.stringify(preset)), message);
  }
});

test('spacers cannot own combinations, but empty spacer combination lists are preserved', () => {
  const preset = minimalPreset();
  preset.rows[0].push({ label: '', hotkeys: [''], spacer: true, combinations: [{ keyId: '0-0', action: 'Action' }] });
  assert.throws(() => parsePresetImport(JSON.stringify(preset)), /spacers cannot have combinations/);
  preset.rows[0][1].combinations = [];
  const [imported] = parsePresetImport(JSON.stringify(preset));
  assert.deepEqual(imported.rows[0][1].combinations, []);
});

test('imported copies are independent even when source IDs are repeated', () => {
  const original = clonePreset(defaultPresets[0]);
  const before = structuredClone(original);
  const [first, second] = parsePresetImport(serializePresets([original, original]));
  first.rows[3][1].hotkeys[0] = 'Changed command';
  first.rows[3][1].combinations![0].action = 'Changed action';
  assert.notEqual(first.id, second.id);
  assert.deepEqual(second.rows, normalizePreset(before).rows);
  assert.deepEqual(original, before);
});
