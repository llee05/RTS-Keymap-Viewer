// src/data/presets.ts

import { defaultPresets } from "./defaultPresets";

export type Keybind = {
  label: string;
  hotkeys: string[];
  combinations?: KeyCombination[];
  width?: number;
  spacer?: boolean;
};

export type KeyCombination = {
  keyId: string;
  action: string;
};

export type KeyboardPreset = {
  id: string;
  name: string;
  game: string;
  rows: Keybind[][];
};

const DATABASE_NAME = "rts-keymap-viewer";
const DATABASE_VERSION = 1;
const PRESET_STORE = "presets";

function openPresetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PRESET_STORE)) {
        database.createObjectStore(PRESET_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seedDefaultPresets(database: IDBDatabase) {
  const transaction = database.transaction(PRESET_STORE, "readwrite");
  const store = transaction.objectStore(PRESET_STORE);

  await Promise.all(
    defaultPresets.map((preset) => requestToPromise(store.put(preset))),
  );
}

export async function loadPresets(): Promise<KeyboardPreset[]> {
  const database = await openPresetDatabase();
  const transaction = database.transaction(PRESET_STORE, "readonly");
  const store = transaction.objectStore(PRESET_STORE);
  const presets = await requestToPromise<KeyboardPreset[]>(store.getAll());

  if (presets.length > 0) {
    return presets;
  }

  await seedDefaultPresets(database);
  return defaultPresets;
}

export async function savePreset(preset: KeyboardPreset): Promise<void> {
  const database = await openPresetDatabase();
  const transaction = database.transaction(PRESET_STORE, "readwrite");
  const store = transaction.objectStore(PRESET_STORE);

  await requestToPromise(store.put(preset));
}

export async function savePresets(presets: KeyboardPreset[]): Promise<void> {
  const database = await openPresetDatabase();
  const transaction = database.transaction(PRESET_STORE, "readwrite");
  const store = transaction.objectStore(PRESET_STORE);

  await Promise.all(presets.map((preset) => requestToPromise(store.put(preset))));
}
