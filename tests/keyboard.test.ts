import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { findMatchingKeys, getKeyOptions, getRelatedKeyIds } from '../src/data/keyboard.ts';
import { clonePreset } from '../src/data/presetEditing.ts';

test('search finds commands regardless of case, word order, or extra whitespace', () => {
  assert.deepEqual([...findMatchingKeys(defaultPresets[0], '  CAMERA   rotate ')], ['2-11', '2-12', '5-3']);
});

test('searching a combination action highlights both keys', () => {
  assert.deepEqual([...findMatchingKeys(defaultPresets[0], 'IDLE villagers')], ['4-9', '5-0']);
  assert.equal(findMatchingKeys(defaultPresets[0], 'no-such-command').size, 0);
  assert.equal(findMatchingKeys(defaultPresets[0], ' \n ').size, 0);
});

test('search can distinguish left/right keys and excludes spacers', () => {
  assert.deepEqual([...findMatchingKeys(defaultPresets[0], 'Right Ctrl')], ['5-7']);
  const preset = clonePreset(defaultPresets[0]);
  preset.rows[6][0].hotkeys = ['Spacer-only command'];
  assert.equal(findMatchingKeys(preset, 'Spacer-only command').size, 0);
});

test('related keys are highlighted from either direction', () => {
  assert.ok(getRelatedKeyIds(defaultPresets[0], '3-1').has('5-0'));
  assert.ok(getRelatedKeyIds(defaultPresets[0], '5-0').has('3-1'));
  assert.equal(getRelatedKeyIds(defaultPresets[0], null).size, 0);
});

test('repeated labels use ordinals and spacer positions remain intact', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [[
    { label: 'Key', hotkeys: [''] },
    { label: '', hotkeys: [''], spacer: true },
    { label: 'Key', hotkeys: [''] },
    { label: 'Key', hotkeys: [''] },
  ]] };
  assert.deepEqual(getKeyOptions(preset), [
    { id: '0-0', label: '1st Key' },
    { id: '0-2', label: '2nd Key' },
    { id: '0-3', label: '3rd Key' },
  ]);
});

test('duplicate labels across rows ignore same-label spacers and name real blank keys', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [
    [{ label: 'Ctrl', hotkeys: [''] }, { label: 'Ctrl', hotkeys: [''], spacer: true }],
    [{ label: '', hotkeys: [''] }, { label: 'Ctrl', hotkeys: [''] }],
  ] };
  assert.deepEqual(getKeyOptions(preset), [
    { id: '0-0', label: 'Left Ctrl' },
    { id: '1-0', label: 'Blank key' },
    { id: '1-1', label: 'Right Ctrl' },
  ]);
  assert.deepEqual([...findMatchingKeys(preset, 'blank key')], ['1-0']);
});

test('ordinal labels handle the teens and resume the correct suffix after twenty', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [
    Array.from({ length: 23 }, () => ({ label: 'Macro', hotkeys: [''] })),
  ] };
  const labels = getKeyOptions(preset).map((option) => option.label);
  assert.deepEqual(labels.slice(10, 13), ['11th Macro', '12th Macro', '13th Macro']);
  assert.deepEqual(labels.slice(19), ['20th Macro', '21st Macro', '22nd Macro', '23rd Macro']);
});

test('related highlights include direct incoming and outgoing combinations without following chains', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [[
    { label: 'A', hotkeys: [''], combinations: [{ keyId: '0-1', action: 'AB' }] },
    { label: 'B', hotkeys: [''], combinations: [{ keyId: '0-2', action: 'BC' }] },
    { label: 'C', hotkeys: [''] },
    { label: 'D', hotkeys: [''], combinations: [{ keyId: '0-1', action: 'DB' }] },
  ]] };
  assert.deepEqual([...getRelatedKeyIds(preset, '0-0')].sort(), ['0-0', '0-1']);
  assert.deepEqual([...getRelatedKeyIds(preset, '0-1')].sort(), ['0-0', '0-1', '0-2', '0-3']);
});

test('search matches combination key labels with the action but does not join unrelated commands', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [[
    { label: 'A', hotkeys: ['Train scout', 'Heal units'], combinations: [{ keyId: '0-1', action: 'Attack move' }] },
    { label: 'Ctrl', hotkeys: [''] },
    { label: '→', hotkeys: ['Pan camera'] },
  ]] };
  assert.deepEqual([...findMatchingKeys(preset, 'CTRL\tmove A')], ['0-0', '0-1']);
  assert.equal(findMatchingKeys(preset, 'train units').size, 0);
  assert.deepEqual([...findMatchingKeys(preset, '→')], ['0-2']);
});

test('searching invalid legacy combinations never returns nonexistent or spacer key positions', () => {
  const preset = { id: 'custom', name: 'Test', game: 'Test', rows: [[
    { label: 'A', hotkeys: [''], combinations: [
      { keyId: '9-9', action: 'Legacy action' },
      { keyId: '0-1', action: 'Legacy action' },
      { keyId: '0-2', action: 'Legacy action' },
      { keyId: '0-2', action: 'Legacy action' },
    ] },
    { label: '', hotkeys: [''], spacer: true },
    { label: 'Ctrl', hotkeys: [''] },
  ]] };
  const before = structuredClone(preset);
  assert.deepEqual([...findMatchingKeys(preset, 'Legacy action')], ['0-0', '0-2']);
  assert.deepEqual(preset, before);
});
