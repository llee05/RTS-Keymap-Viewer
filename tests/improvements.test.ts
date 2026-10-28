import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { clonePreset, createBlankPreset, normalizePreset } from '../src/data/presetEditing.ts';
import { findCommandResults, getCommandEntries } from '../src/data/keyboard.ts';
import { getPresetValidationErrors } from '../src/data/presetValidation.ts';
import { assignRecordedHotkey, findRecordedCombination } from '../src/data/hotkeyCapture.ts';
import { createPresetBackups, parsePresetImport, serializePresets } from '../src/data/presetTransfer.ts';
import { readActivePreset, rememberActivePreset, readRecoveredDraft, rememberDraft } from '../src/data/browserState.ts';

test('shortcut notation identifies complete combinations and results represent commands, not participants', () => {
  assert.equal(findCommandResults(defaultPresets[0], 'idle villagers').length, 1);
  for (const query of ['Ctrl+A', 'Control + A', 'A+Left Ctrl']) {
    const results = findCommandResults(defaultPresets[0], query);
    assert.equal(results.length, 1, query);
    assert.equal(results[0].action, 'Select all units on screen');
    assert.deepEqual(results[0].keyIds, ['3-1', '5-0']);
  }
  assert.equal(findCommandResults(defaultPresets[0], 'Right Ctrl+A').length, 0);
  const plus = clonePreset(defaultPresets[0]);
  plus.rows[2][4].hotkeys = ['Build + Repair'];
  assert.equal(findCommandResults(plus, 'Build+Repair')[0].action, 'Build + Repair');
  assert.equal(findCommandResults(defaultPresets[0], '', 'Camera').some((entry) => entry.action === 'Pan camera up'), true);
  assert.equal(findCommandResults(defaultPresets[0], 'Ctrl+1')[0].action, 'Create control group 1');
  assert.equal(findCommandResults(defaultPresets[0], 'Shift+1')[0].action, 'Add to control group 1');
  assert.equal(getCommandEntries(defaultPresets[0]).filter((entry) => entry.combination && entry.keyIds.includes('5-0')).length, 14);
});

test('complete shortcut conflicts are detected across owners and require distinct contexts', () => {
  const preset = clonePreset(defaultPresets[0]);
  preset.rows[5][0].combinations = [{ keyId: '3-1', action: 'Conflicting action' }];
  assert.match(getPresetValidationErrors(preset)[0], /repeated.*distinct context/);
  assert.throws(() => parsePresetImport(serializePresets([preset])), /repeated/);
  preset.rows[5][0].combinations[0].context = 'Spectator';
  assert.deepEqual(getPresetValidationErrors(preset), []);
  const updated = assignRecordedHotkey(preset, ['5-0', '3-1'], 'Spectator selection', 'spectator');
  assert.equal(updated.rows[5][0].combinations![0].action, 'Spectator selection');
  assert.equal(updated.rows[3][1].combinations![0].action, 'Select all units on screen');
  assert.equal(findRecordedCombination(updated, ['3-1', '5-0'], 'SPECTATOR')?.action, 'Spectator selection');
});

test('blank copies retain physical positions and sizes without assignments or inherited provenance', () => {
  const blank = createBlankPreset(defaultPresets[0]);
  assert.notEqual(blank.id, defaultPresets[0].id);
  assert.equal(blank.rows[5][4].width, 8);
  assert.equal(blank.rows.flat().some((key) => key.combinations?.length || key.hotkeys.some((command) => command.trim())), false);
  assert.equal(blank.source, '');
  assert.equal(defaultPresets[0].rows[3][1].hotkeys[0], 'Attack Move');
});

test('names and game labels are trimmed and blank details cannot be imported', () => {
  const preset = { ...clonePreset(defaultPresets[0]), name: '  My preset  ', game: '  Test  ' };
  assert.equal(normalizePreset(preset).name, 'My preset');
  assert.equal(normalizePreset(preset).game, 'Test');
  preset.name = '  ';
  assert.match(getPresetValidationErrors(preset)[0], /Name/);
  assert.throws(() => parsePresetImport(serializePresets([preset])), /Name/);
});

test('category, context and provenance survive backups and large libraries produce importable parts', () => {
  const preset = assignRecordedHotkey(defaultPresets[0], ['5-0', '4-0', '2-4'], 'Rally', 'Combat', 'Units');
  const [restored] = parsePresetImport(serializePresets([preset]));
  assert.equal(restored.source, preset.source);
  assert.equal(restored.version, preset.version);
  assert.equal(restored.rows[2][4].combinations![0].context, 'Combat');
  assert.equal(restored.rows[2][4].combinations![0].category, 'Units');
  const backups = createPresetBackups(Array.from({ length: 101 }, (_, index) => ({ ...preset, id: `custom-${index}` })));
  assert.equal(backups.length, 2);
  assert.deepEqual(backups.map((backup) => parsePresetImport(backup).length), [100, 1]);
  const large = { ...preset, rows: [[{ label: 'A', hotkeys: ['x'.repeat(1_100_000)] }]] };
  assert.equal(createPresetBackups([large, large]).length, 2);
});

test('recovery preserves incomplete raw drafts and safely handles malformed or blocked browser storage', () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    const preset = clonePreset(defaultPresets[0]);
    preset.name = '';
    preset.rows[3][1].hotkeys = ['  unfinished  ', ''];
    assert.equal(rememberDraft({ preset, activePresetId: defaultPresets[0].id }), true);
    assert.deepEqual(JSON.parse(JSON.stringify(readRecoveredDraft()!.preset)), JSON.parse(JSON.stringify(preset)));
    rememberActivePreset('custom-test');
    assert.equal(readActivePreset(), 'custom-test');
    values.set('rts-keymap-draft', '{bad');
    assert.equal(readRecoveredDraft(), null);
    values.set('rts-keymap-draft', JSON.stringify({ preset: { rows: [null] }, activePresetId: 'test' }));
    assert.equal(readRecoveredDraft(), null);
    rememberDraft(null);
    assert.equal(readRecoveredDraft(), null);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Blocked'); } });
    assert.equal(readRecoveredDraft(), null);
    assert.equal(rememberDraft({ preset, activePresetId: 'test' }), false);
    assert.doesNotThrow(() => rememberActivePreset('test'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
