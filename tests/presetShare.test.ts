import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { normalizePreset } from '../src/data/presetEditing.ts';
import { MAX_IMPORT_BYTES } from '../src/data/presetTransfer.ts';
import { createShareUrl, decodeShareHash, MAX_SHARE_URL_LENGTH, parseShareHash } from '../src/data/presetShare.ts';
import type { KeyboardPreset } from '../src/data/presets.ts';

const address = 'https://example.org/RTS-Keymap-Viewer/?demo=1#edit';
const fixture = (): KeyboardPreset => ({
  id: 'custom-source', name: '  帝国 🏹  ', game: ' RTS ', source: 'https://example.org/来源', version: '版本 1',
  rows: [[
    { label: 'Ctrl', hotkeys: [''], width: 1.5, category: 'Selection', combinations: [
      { keyId: '0-1', action: '选取全部 🦉', category: '军队', context: '战斗', additionalKeyIds: ['0-2'] },
      { keyId: '0-1', action: 'Select', context: 'Menu' },
    ] },
    { label: 'Shift', hotkeys: ['  First\n Second  ', '', 'Third'], height: 2, context: 'General' },
    { label: 'A', hotkeys: [] },
    { label: '', hotkeys: [], spacer: true, width: 0.5 },
  ]],
});
const rawHash = (text: string | Uint8Array) => `#share=v1.${gzipSync(text).toString('base64url')}`;
const hashFor = async (preset: KeyboardPreset) => new URL(await createShareUrl(preset, address)).hash;

test('native gzip share round trips the bundled layout without changing the source or URL path', async () => {
  const source = structuredClone(defaultPresets[0]);
  const before = structuredClone(source);
  const url = new URL(await createShareUrl(source, address));
  assert.equal(url.origin + url.pathname + url.search, 'https://example.org/RTS-Keymap-Viewer/?demo=1');
  assert.match(url.hash, /^#share=v1\.[A-Za-z0-9_-]+$/);
  assert.ok(url.href.length <= MAX_SHARE_URL_LENGTH);
  assert.deepEqual(await decodeShareHash(url.hash), normalizePreset(source));
  assert.deepEqual(source, before);
});

test('sharing preserves Unicode, combinations, additional participants, provenance, spacers and dimensions', async () => {
  const source = fixture();
  const before = structuredClone(source);
  const restored = await decodeShareHash(await hashFor(source));
  assert.deepEqual(restored, normalizePreset(source));
  assert.deepEqual(source, before);
  restored.rows[0][0].combinations![0].additionalKeyIds!.push('0-3');
  assert.deepEqual(source, before);
});

test('hash parsing separates View/Edit navigation from share links', () => {
  for (const hash of ['', '#view', '#edit', '#other']) assert.equal(parseShareHash(hash), null);
  assert.equal(parseShareHash('#share=v1.YQ'), 'YQ');
  for (const hash of ['#share', '#share=', '#share=v1', '#share=v1.', '#share=v1.A', '#share=v1.a+b', '#share=v1.a/b', '#share=v1.a=', '#share=v1.aa?b', '#share=v1.aa#view']) {
    assert.throws(() => parseShareHash(hash), /incomplete|invalid/);
  }
  for (const version of ['v2', 'v0', '1', '']) assert.throws(() => parseShareHash(`#share=${version}.YQ`), /version is not supported/);
  assert.throws(() => parseShareHash('#share=v1.' + 'a'.repeat(MAX_SHARE_URL_LENGTH)), /Export preset JSON/);
});

test('decoding rejects ordinary, malformed, corrupt, truncated and wrong-version fragments cleanly', async () => {
  const valid = await hashFor(fixture());
  for (const hash of ['#view', '#edit', '#share', '#share=v1.', '#share=v2.YQ', '#share=v1.YR', '#share=v1.YQ', valid.slice(0, -8)]) {
    await assert.rejects(decodeShareHash(hash), /shared layout|shared layout version|payload/i);
  }
  const bytes = Buffer.from(valid.split('.')[1], 'base64url');
  bytes[bytes.length - 6] ^= 0xff;
  await assert.rejects(decodeShareHash('#share=v1.' + bytes.toString('base64url')), /corrupt or incomplete/);
});

test('decoded content must be valid UTF-8 JSON and a single validated preset', async () => {
  for (const value of ['{bad', '', new Uint8Array([0xff, 0xfe])]) {
    await assert.rejects(decodeShareHash(rawHash(value)), /valid UTF-8 JSON/);
  }
  for (const value of [null, [fixture()], { format: 'rts-keymap-viewer', version: 1, presets: [fixture()] }]) {
    await assert.rejects(decodeShareHash(rawHash(JSON.stringify(value))));
  }
  const source = { ...fixture(), unknown: 'discard', rows: [[{ label: 'A', hotkeys: [' Command '], unknown: true }]] };
  const decoded = await decodeShareHash(rawHash(JSON.stringify(source)));
  assert.equal('unknown' in decoded, false);
  assert.equal('unknown' in decoded.rows[0][0], false);
  assert.deepEqual(decoded.rows[0][0].hotkeys, ['Command']);
});

test('both share creation and decode use import shape, dimension, metadata and reference validation', async () => {
  const invalid: [KeyboardPreset, RegExp][] = [
    [{ ...fixture(), name: '  ' }, /Name must not be blank/],
    [{ ...fixture(), game: '' }, /Game must not be blank/],
    [{ ...fixture(), rows: [] }, /between 1 and 30/],
    [{ ...fixture(), rows: Array.from({ length: 31 }, () => [{ label: 'A', hotkeys: [''] }]) }, /between 1 and 30/],
    [{ ...fixture(), rows: [[]] }, /nonempty/],
    [{ ...fixture(), rows: [Array.from({ length: 501 }, () => ({ label: 'A', hotkeys: [''] }))] }, /500 keys/],
  ];
  for (const dimension of ['width', 'height']) {
    for (const size of [0, -1, 30.1]) {
      const preset = fixture();
      Object.assign(preset.rows[0][0], { [dimension]: size });
      invalid.push([preset, /positive number no greater than 30/]);
    }
  }
  for (const keyId of ['9-9', '0-0', '0-3', '00-1']) {
    const preset = fixture();
    preset.rows[0][0].combinations![0].keyId = keyId;
    invalid.push([preset, /does not exist|itself|spacer/]);
  }
  const duplicate = fixture();
  duplicate.rows[0][2].combinations = [{ keyId: '0-1', additionalKeyIds: ['0-0'], action: 'Duplicate', context: ' 战斗 ' }];
  invalid.push([duplicate, /repeated/]);
  const repeatedTarget = fixture();
  repeatedTarget.rows[0][0].combinations![0].additionalKeyIds = ['0-1'];
  invalid.push([repeatedTarget, /repeated/]);
  for (const [preset, message] of invalid) {
    await assert.rejects(createShareUrl(preset, address), message);
    await assert.rejects(decodeShareHash(rawHash(JSON.stringify(preset))), message);
  }
  const wrongType = { ...fixture(), source: 12 };
  await assert.rejects(decodeShareHash(rawHash(JSON.stringify(wrongType))), /source must be text/);
});

test('share encoding enforces the UTF-8 byte ceiling before compression', async () => {
  const preset = fixture();
  preset.rows[0][1].hotkeys = ['🦉'.repeat(MAX_IMPORT_BYTES / 4)];
  await assert.rejects(createShareUrl(preset, address), /2 MB/);
});

test('decode accepts exactly 2 MiB and rejects highly compressed decompression bombs beyond it', async () => {
  const json = JSON.stringify(fixture());
  const exact = json + ' '.repeat(MAX_IMPORT_BYTES - Buffer.byteLength(json));
  assert.deepEqual(await decodeShareHash(rawHash(exact)), normalizePreset(fixture()));
  const bomb = rawHash(exact + ' ');
  assert.ok(bomb.length < MAX_SHARE_URL_LENGTH);
  await assert.rejects(decodeShareHash(bomb), /2 MB decompressed limit/);
});

test('decode immediately cancels a stream when its first chunk exceeds the byte ceiling', async () => {
  const original = globalThis.DecompressionStream;
  let reads = 0;
  let cancelled = false;
  class OversizedStream {
    writable = new WritableStream();
    readable = new ReadableStream({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(MAX_IMPORT_BYTES + 1)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
  }
  Object.defineProperty(globalThis, 'DecompressionStream', { value: OversizedStream, configurable: true, writable: true });
  try {
    await assert.rejects(decodeShareHash('#share=v1.YQ'), /2 MB decompressed limit/);
    assert.equal(reads, 1);
    assert.equal(cancelled, true);
  } finally { globalThis.DecompressionStream = original; }
});

test('URL ceiling covers compressed payloads and the full hosting address', async () => {
  const preset = fixture();
  preset.rows[0][1].hotkeys = [randomBytes(18_000).toString('base64')];
  await assert.rejects(createShareUrl(preset, address), /16,000.*Export preset JSON/);
  const normal = await createShareUrl(fixture(), address);
  const prefix = 'https://example.org/';
  const hash = new URL(normal).hash;
  const boundary = prefix + 'a'.repeat(MAX_SHARE_URL_LENGTH - prefix.length - hash.length);
  assert.equal((await createShareUrl(fixture(), boundary)).length, MAX_SHARE_URL_LENGTH);
  await assert.rejects(createShareUrl(fixture(), boundary + 'a'), /Export preset JSON/);
});

test('missing native compression capabilities offer a JSON alternative', async () => {
  const compressor = globalThis.CompressionStream;
  const decompressor = globalThis.DecompressionStream;
  try {
    Object.defineProperty(globalThis, 'CompressionStream', { value: undefined, configurable: true, writable: true });
    await assert.rejects(createShareUrl(fixture(), address), /cannot compress.*Export preset JSON/);
    Object.defineProperty(globalThis, 'DecompressionStream', { value: undefined, configurable: true, writable: true });
    await assert.rejects(decodeShareHash('#share=v1.YQ'), /cannot open.*Export preset JSON/);
  } finally {
    globalThis.CompressionStream = compressor;
    globalThis.DecompressionStream = decompressor;
  }
});

test('navigation can abort decoding before reading or while decompression is active', async () => {
  const hash = rawHash(JSON.stringify(fixture()) + ' '.repeat(MAX_IMPORT_BYTES / 2));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(decodeShareHash(hash, controller.signal), { name: 'AbortError' });
  const pending = new AbortController();
  const decoding = decodeShareHash(hash, pending.signal);
  pending.abort();
  await assert.rejects(decoding, { name: 'AbortError' });
});
