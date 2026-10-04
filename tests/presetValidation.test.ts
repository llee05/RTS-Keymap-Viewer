import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { getPresetValidationErrors, validatePreset } from '../src/data/presetValidation.ts';
import { savePreset, savePresets, type KeyboardPreset } from '../src/data/presets.ts';

function presetWithTargets(...targets: string[]): KeyboardPreset {
  return {
    id: 'custom-validation',
    name: 'Validation preset',
    game: 'Test',
    rows: [[
      { label: 'A', hotkeys: ['Attack'], combinations: targets.map((keyId) => ({ keyId, action: 'Action' })) },
      { label: '', hotkeys: [''], spacer: true },
      { label: 'Ctrl', hotkeys: [''] },
      { label: 'Ctrl', hotkeys: [''] },
    ]],
  };
}

test('every bundled preset has valid combinations', () => {
  defaultPresets.forEach((preset) => assert.doesNotThrow(() => validatePreset(preset)));
  const preset = defaultPresets.find((preset) => preset.id === 'aoe4-default')!;
  const targetId = preset.rows[3][1].combinations![0].keyId;
  const [rowIndex, keyIndex] = targetId.split('-').map(Number);
  assert.equal(preset.rows[rowIndex][keyIndex].label, 'Ctrl');
});

test('spacer positions count and repeated labels are distinct combination targets', () => {
  assert.deepEqual(getPresetValidationErrors(presetWithTargets('0-2', '0-3')), []);
});

test('missing and malformed target positions are rejected', () => {
  for (const target of ['9-0', '0-9', 'invalid', '-1-0', '00-2']) {
    assert.match(getPresetValidationErrors(presetWithTargets(target))[0], /does not exist/);
  }
});

test('a spacer cannot be a combination target', () => {
  assert.match(getPresetValidationErrors(presetWithTargets('0-1'))[0], /spacer/);
});

test('self-targets and duplicate targets are rejected', () => {
  const errors = getPresetValidationErrors(presetWithTargets('0-0', '0-2', '0-2'));
  assert.equal(errors.length, 2);
  assert.match(errors[0], /itself/);
  assert.match(errors[1], /repeated/);
});

test('validation preserves existing preset data', () => {
  const preset = presetWithTargets('0-0', '0-2', '0-2');
  const before = structuredClone(preset);
  getPresetValidationErrors(preset);
  assert.throws(() => validatePreset(preset), /itself/);
  assert.deepEqual(preset, before);
});

test('invalid presets are rejected before opening storage, including batch saves', async () => {
  await assert.rejects(savePreset(presetWithTargets('0-0')), /itself/);
  await assert.rejects(savePresets([presetWithTargets('0-2'), presetWithTargets('0-1')]), /spacer/);
});
