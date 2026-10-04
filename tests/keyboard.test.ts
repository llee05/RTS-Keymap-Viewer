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
