import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { defaultPresets } from '../src/data/defaultPresets.ts';
import { clonePreset } from '../src/data/presetEditing.ts';
import { deletePreset, loadPresets, savePreset, savePresets, type KeyboardPreset } from '../src/data/presets.ts';

function request<T>(result: T) {
  return {
    result,
    error: null as DOMException | null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
}

// Drive storage boundary events explicitly. Real IndexedDB persistence and
// rollback remain covered by the browser suite; this stub does not emulate them.
function transaction(t: TestContext, stored: KeyboardPreset[]) {
  const read = request(stored);
  const store = {
    getAll: t.mock.fn(() => read),
    put: t.mock.fn((preset: KeyboardPreset) => request(preset.id)),
    delete: t.mock.fn((id: string) => request(id)),
  };
  return {
    store,
    read,
    error: null as DOMException | null,
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    onerror: null as (() => void) | null,
    abort: t.mock.fn(),
    objectStore: t.mock.fn((name: string) => {
      assert.equal(name, 'presets');
      return store;
    }),
  };
}

function setupDatabase(t: TestContext, stored: KeyboardPreset[] = [], hasStore = true) {
  const transactions: ReturnType<typeof transaction>[] = [];
  const database = {
    close: t.mock.fn(),
    objectStoreNames: { contains: t.mock.fn((name: string) => hasStore && name === 'presets') },
    createObjectStore: t.mock.fn(),
    transaction: t.mock.fn((name: string, mode: IDBTransactionMode) => {
      assert.equal(name, 'presets');
      assert.ok(mode === 'readonly' || mode === 'readwrite');
      const current = transaction(t, stored);
      transactions.push(current);
      return current;
    }),
  };
  const opening = { ...request(database), onupgradeneeded: null as (() => void) | null };
  const factory = { open: t.mock.fn(() => opening) };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: factory });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  });
  return { database, opening, factory, transactions };
}

async function connect(storage: ReturnType<typeof setupDatabase>) {
  assert.ok(storage.opening.onsuccess);
  storage.opening.onsuccess();
  await Promise.resolve();
}

async function readPresets(storage: ReturnType<typeof setupDatabase>) {
  await connect(storage);
  assert.ok(storage.transactions[0].read.onsuccess);
  storage.transactions[0].read.onsuccess();
  await Promise.resolve();
}

function customPreset(id = 'custom-storage'): KeyboardPreset {
  return { ...clonePreset(defaultPresets[0]), id, name: 'Storage preset' };
}

test('first load creates the keyed store and waits for default seeding to commit', async (t) => {
  const storage = setupDatabase(t, [], false);
  let settled = false;
  const loading = loadPresets();
  void loading.then(() => { settled = true; });
  assert.deepEqual(storage.factory.open.mock.calls[0].arguments, ['rts-keymap-viewer', 1]);
  storage.opening.onupgradeneeded!();
  assert.deepEqual(storage.database.createObjectStore.mock.calls[0].arguments, ['presets', { keyPath: 'id' }]);
  await readPresets(storage);
  assert.deepEqual(storage.database.transaction.mock.calls.map((call) => call.arguments), [
    ['presets', 'readonly'], ['presets', 'readwrite'],
  ]);
  assert.deepEqual(storage.transactions[1].store.put.mock.calls.map((call) => call.arguments[0]), defaultPresets);
  assert.equal(settled, false);
  assert.equal(storage.database.close.mock.callCount(), 0);
  storage.transactions[1].oncomplete!();
  assert.deepEqual(await loading, defaultPresets);
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('an existing object store is not recreated during an upgrade', async (t) => {
  const storage = setupDatabase(t);
  const loading = loadPresets();
  storage.opening.onupgradeneeded!();
  assert.equal(storage.database.createObjectStore.mock.callCount(), 0);
  await readPresets(storage);
  storage.transactions[1].oncomplete!();
  await loading;
});

test('loading refreshes bundled layouts but preserves legacy custom rows and invalid combinations', async (t) => {
  const bundled = clonePreset(defaultPresets[0]);
  bundled.name = 'Old bundled edits';
  bundled.rows.shift();
  const custom = customPreset();
  custom.rows = [[{ label: 'UP', hotkeys: ['  Custom command  '], combinations: [{ keyId: '0-0', action: 'Legacy self target' }] }]];
  const existing = [custom, bundled];
  const before = structuredClone(existing);
  const storage = setupDatabase(t, existing);
  const loading = loadPresets();
  await readPresets(storage);
  storage.transactions[1].oncomplete!();
  assert.deepEqual(await loading, [...defaultPresets, custom]);
  assert.deepEqual(existing, before);
  assert.deepEqual(storage.transactions[1].store.put.mock.calls.map((call) => call.arguments[0].id), defaultPresets.map((preset) => preset.id));
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('a failed read rejects loading, closes the connection, and does not seed', async (t) => {
  const storage = setupDatabase(t);
  const failure = new DOMException('Read failed', 'UnknownError');
  const loading = loadPresets();
  const rejected = assert.rejects(loading, (error) => error === failure);
  await connect(storage);
  storage.transactions[0].read.error = failure;
  storage.transactions[0].read.onerror!();
  await rejected;
  assert.equal(storage.transactions.length, 1);
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('a failed seed rejects loading even when custom records were read successfully', async (t) => {
  const storage = setupDatabase(t, [customPreset()]);
  const failure = new DOMException('Seed failed', 'QuotaExceededError');
  const loading = loadPresets();
  const rejected = assert.rejects(loading, (error) => error === failure);
  await readPresets(storage);
  storage.transactions[1].error = failure;
  storage.transactions[1].onabort!();
  await rejected;
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('load, save, and deletion propagate database open failures', async (t) => {
  const operations = { load: loadPresets, save: () => savePreset(customPreset()), delete: () => deletePreset('custom-storage') };
  for (const [name, operation] of Object.entries(operations)) {
    await t.test(name, async (t) => {
      const storage = setupDatabase(t);
      const failure = new DOMException('Storage unavailable', 'SecurityError');
      const result = operation();
      const rejected = assert.rejects(result, (error) => error === failure);
      storage.opening.error = failure;
      storage.opening.onerror!();
      await rejected;
      assert.equal(storage.transactions.length, 0);
      assert.equal(storage.database.close.mock.callCount(), 0);
    });
  }
});

test('a synchronous database open failure is returned as a rejected promise', async (t) => {
  const storage = setupDatabase(t);
  const failure = new DOMException('Storage blocked', 'SecurityError');
  storage.factory.open.mock.mockImplementation(() => { throw failure; });
  await assert.rejects(savePreset(customPreset()), (error) => error === failure);
  assert.equal(storage.transactions.length, 0);
});

test('batch saves use one transaction and do not resolve at request success', async (t) => {
  const storage = setupDatabase(t);
  const presets = [customPreset('custom-first'), customPreset('custom-second')];
  const before = structuredClone(presets);
  let settled = false;
  const saving = savePresets(presets);
  void saving.then(() => { settled = true; });
  await connect(storage);
  const writing = storage.transactions[0];
  assert.equal(storage.transactions.length, 1);
  assert.deepEqual(writing.store.put.mock.calls.map((call) => call.arguments[0]), presets);
  writing.store.put.mock.calls.forEach((call) => call.result?.onsuccess?.());
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(storage.database.close.mock.callCount(), 0);
  writing.oncomplete!();
  await saving;
  assert.deepEqual(presets, before);
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('transaction aborts and errors reject saves and close the connection', async (t) => {
  const cases = [
    { event: 'onabort', error: new DOMException('Quota exhausted', 'QuotaExceededError'), message: /Quota exhausted/ },
    { event: 'onabort', error: null, message: /Database transaction aborted/ },
    { event: 'onerror', error: new DOMException('Write failed', 'UnknownError'), message: /Write failed/ },
    { event: 'onerror', error: null, message: /Database transaction failed/ },
  ] as const;
  for (const { event, error, message } of cases) {
    await t.test(`${event}: ${error?.message ?? 'no error supplied'}`, async (t) => {
      const storage = setupDatabase(t);
      const saving = savePreset(customPreset());
      const rejected = assert.rejects(saving, message);
      await connect(storage);
      storage.transactions[0].error = error;
      storage.transactions[0][event]!();
      await rejected;
      assert.equal(storage.database.close.mock.callCount(), 1);
    });
  }
});

test('a synchronous put failure aborts the batch and skips subsequent writes', async (t) => {
  const storage = setupDatabase(t);
  const failure = new DOMException('Cannot clone preset', 'DataCloneError');
  const saving = savePresets([customPreset('custom-first'), customPreset('custom-second')]);
  const rejected = assert.rejects(saving, (error) => error === failure);
  const createTransaction = storage.database.transaction;
  createTransaction.mock.mockImplementation((name, mode) => {
    const writing = transaction(t, []);
    storage.transactions.push(writing);
    assert.equal(name, 'presets');
    assert.equal(mode, 'readwrite');
    writing.store.put.mock.mockImplementation(() => { throw failure; });
    return writing;
  });
  await connect(storage);
  await rejected;
  assert.equal(storage.transactions[0].store.put.mock.callCount(), 1);
  assert.equal(storage.transactions[0].abort.mock.callCount(), 1);
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('failure to start a write transaction still closes the opened database', async (t) => {
  const storage = setupDatabase(t);
  const failure = new DOMException('Database closing', 'InvalidStateError');
  storage.database.transaction.mock.mockImplementation(() => { throw failure; });
  const saving = savePreset(customPreset());
  const rejected = assert.rejects(saving, (error) => error === failure);
  await connect(storage);
  await rejected;
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('deletion targets only the requested ID and waits for transaction completion', async (t) => {
  const storage = setupDatabase(t);
  let settled = false;
  const deleting = deletePreset('custom-storage');
  void deleting.then(() => { settled = true; });
  await connect(storage);
  const writing = storage.transactions[0];
  assert.deepEqual(writing.store.delete.mock.calls.map((call) => call.arguments), [['custom-storage']]);
  assert.equal(writing.store.put.mock.callCount(), 0);
  await Promise.resolve();
  assert.equal(settled, false);
  writing.oncomplete!();
  await deleting;
  assert.equal(storage.database.close.mock.callCount(), 1);
});

test('an aborted deletion rejects and closes its connection', async (t) => {
  const storage = setupDatabase(t);
  const deleting = deletePreset('custom-storage');
  const rejected = assert.rejects(deleting, /Database transaction aborted/);
  await connect(storage);
  storage.transactions[0].onabort!();
  await rejected;
  assert.equal(storage.database.close.mock.callCount(), 1);
});
