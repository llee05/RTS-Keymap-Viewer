import type { KeyboardPreset } from './presets.ts';
import { MAX_IMPORT_BYTES, readPreset } from './presetTransfer.ts';

export const MAX_SHARE_URL_LENGTH = 16_000;
const PREFIX = '#share=v1.';
const TOO_LONG = 'This layout needs a link longer than 16,000 characters. Use Export preset JSON instead.';

function toBase64Url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Ordinary screen hashes never enter the asynchronous decoder.
export function parseShareHash(hash: string): string | null {
  if (!hash.startsWith('#share')) return null;
  if (hash.length > MAX_SHARE_URL_LENGTH) throw new Error(TOO_LONG);
  const match = /^#share=([^.]*)\.(.*)$/.exec(hash);
  if (!match) throw new Error('The shared layout link is incomplete or invalid.');
  if (match[1] !== 'v1') throw new Error('This shared layout version is not supported.');
  const payload = match[2];
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) {
    throw new Error('The shared layout payload is invalid.');
  }
  return payload;
}

export async function createShareUrl(preset: KeyboardPreset, address: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser cannot compress share links. Use Export preset JSON instead.');
  }
  const text = JSON.stringify(readPreset(preset));
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('Shared layouts must be no larger than 2 MB. Shorten the command text.');
  }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  if (Math.ceil(bytes.length * 4 / 3) + PREFIX.length > MAX_SHARE_URL_LENGTH) throw new Error(TOO_LONG);
  const url = new URL(address);
  url.hash = PREFIX + toBase64Url(bytes);
  if (url.href.length > MAX_SHARE_URL_LENGTH) throw new Error(TOO_LONG);
  return url.href;
}

export async function decodeShareHash(hash: string, signal?: AbortSignal): Promise<KeyboardPreset> {
  const payload = parseShareHash(hash);
  if (payload === null) throw new Error('This URL does not contain a shared layout.');
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot open compressed share links. Ask for an Export preset JSON backup instead.');
  }
  signal?.throwIfAborted();
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
  if (toBase64Url(bytes) !== payload) throw new Error('The shared layout payload is invalid.');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      let result: ReadableStreamReadResult<Uint8Array>;
      try { result = await reader.read(); } catch { throw new Error('The shared layout is corrupt or incomplete.'); }
      signal?.throwIfAborted();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_IMPORT_BYTES) {
        cancel();
        throw new Error('The shared layout exceeds the 2 MB decompressed limit.');
      }
      chunks.push(result.value);
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  const decoded = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded)); }
  catch { throw new Error('The shared layout does not contain valid UTF-8 JSON.'); }
  return readPreset(value);
}
