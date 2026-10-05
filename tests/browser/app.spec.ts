import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { defaultPresets } from '../../src/data/defaultPresets';
import type { KeyboardPreset } from '../../src/data/presets';

const key = (page: Page, id: string) => page.locator(`.key[data-key-position="${id}"]`);
const status = (page: Page) => page.locator('.database-status');
const pageErrors = new WeakMap<Page, string[]>();

async function storedPresets(page: Page): Promise<KeyboardPreset[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('rts-keymap-viewer', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction('presets').objectStore('presets').getAll();
      read.onsuccess = () => { database.close(); resolve(read.result); };
      read.onerror = () => { database.close(); reject(read.error); };
    };
  }));
}

async function makeCustom(page: Page, name = 'Browser preset') {
  await page.getByRole('button', { name: 'New preset' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  return page.getByLabel('Active layout').inputValue();
}

async function openKey(page: Page, id = '2-1') {
  await key(page, id).scrollIntoViewIfNeeded();
  await key(page, id).focus();
  await page.keyboard.press('Enter');
  return page.getByRole('dialog');
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('./');
  await expect(status(page)).toHaveText('Loaded from local database');
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('tooltips describe focused keys, highlight both directions, and dismiss without moving focus', async ({ page }) => {
  await key(page, '3-1').scrollIntoViewIfNeeded();
  await key(page, '3-1').focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('A + Left Ctrl: Select all units on screen');
  await expect(key(page, '3-1')).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') as string);
  expect(await tooltip.evaluate((element) => element.parentElement === document.body)).toBe(true);
  await expect(key(page, '5-0')).toHaveClass(/key-combo-highlight/);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(key(page, '3-1')).toBeFocused();
  await key(page, '5-0').scrollIntoViewIfNeeded();
  await key(page, '5-0').focus();
  await expect(key(page, '3-1')).toHaveClass(/key-combo-highlight/);
  await page.locator('.keyboard-frame').evaluate((element) => element.dispatchEvent(new Event('scroll')));
  await expect(tooltip).toHaveCount(0);
  await key(page, '3-1').focus();
  await expect(tooltip).toBeVisible();
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
  await expect(tooltip).toHaveCount(0);
});

test('search highlights command and combination matches, cycles focus, and keeps assigned markers visible', async ({ page }) => {
  await expect(key(page, '3-1').locator('.key-assigned-marker')).toHaveCount(1);
  await expect(key(page, '3-1').locator('.key-combination-marker')).toHaveCount(1);
  await expect(key(page, '2-8').locator('.key-assigned-marker')).toHaveCount(0);
  await page.getByLabel('Search commands or keys').fill('idle villagers');
  await expect(page.locator('.search-status')).toHaveText('2 matching keys');
  await expect(key(page, '4-9')).toHaveClass(/key-search-match/);
  await expect(key(page, '5-0')).toHaveClass(/key-search-match/);
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(key(page, '4-9')).toBeFocused();
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(key(page, '5-0')).toBeFocused();
  await page.getByLabel('Search commands or keys').fill('no-such-command');
  await expect(page.locator('.search-status')).toHaveText('No matching keys');
  await expect(page.getByRole('button', { name: 'Next match' })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.key-search-match')).toHaveCount(0);
});

test('key dialogs preserve multiline typing, combination inputs, focus, save/cancel and reload persistence', async ({ page }) => {
  const id = await makeCustom(page);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const dialog = await openKey(page);
  await expect(dialog).toHaveAccessibleName('Edit Q');
  const commands = dialog.getByRole('textbox', { name: 'Q hotkeys' });
  await expect(commands).toBeFocused();
  await commands.fill('');
  await page.keyboard.type('  First command  ');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second command ');
  await expect(commands).toHaveValue('  First command  \n\nSecond command ');
  await dialog.getByLabel('Combination key').selectOption('5-0');
  await dialog.getByLabel('Action', { exact: true }).fill('');
  await page.keyboard.type('Queue units');
  await page.keyboard.press('Enter');
  await expect(dialog.getByLabel('Combination key')).toHaveValue('5-0');
  await dialog.getByRole('button', { name: 'Add combination' }).focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('textbox', { name: 'Q + Left Ctrl action' })).toHaveValue('Queue units');
  await expect(dialog.getByLabel('Combination key').locator('option[value="2-1"]')).toHaveCount(0);
  await expect(dialog.getByLabel('Combination key').locator('option[value="5-0"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(key(page, '2-1')).toBeFocused();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  let saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.rows[2][1].hotkeys).toEqual(['First command', 'Second command']);
  expect(saved.rows[2][1].combinations![0].action).toBe('Queue units');
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(id);
  await page.getByRole('button', { name: 'New preset' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Discarded copy');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Active layout')).toHaveValue(id);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await openKey(page);
  await page.getByRole('textbox', { name: 'Q hotkeys' }).fill('Discard this command');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(key(page, '2-1')).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.rows[2][1].hotkeys).toEqual(['First command', 'Second command']);
});

test('Add hotkey records a key without clicking the keyboard and saves a persistent custom draft', async ({ page }) => {
  const before = await storedPresets(page);
  const add = page.getByRole('button', { name: 'Add hotkey', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add hotkey', exact: true });
  await expect(dialog.getByLabel('Command', { exact: true })).toBeFocused();
  await dialog.getByLabel('Command', { exact: true }).fill('  Rally troops  ');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.down('KeyR');
  await expect(dialog.getByRole('status')).toContainText('R');
  await expect(dialog.getByRole('button', { name: 'Add hotkey', exact: true })).toBeDisabled();
  await page.keyboard.up('KeyR');
  await expect(dialog.getByRole('status')).toHaveText('R');
  await dialog.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(key(page, '2-4')).toContainText('Rally troops');
  expect(await storedPresets(page)).toEqual(before);
  await page.getByRole('button', { name: 'Save as custom', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  const id = await page.getByLabel('Active layout').inputValue();
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(id);
  await key(page, '2-4').scrollIntoViewIfNeeded();
  await key(page, '2-4').hover();
  await expect(page.getByRole('tooltip')).toContainText('Rally troops');
  expect((await storedPresets(page)).find((preset) => preset.id === id)!.rows[2][4].hotkeys).toEqual(['Rally troops']);
});

test('recording supports sided multi-key combinations, search, highlighting, and existing key editors', async ({ page }) => {
  const id = await makeCustom(page);
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add hotkey', exact: true });
  await dialog.getByLabel('Command', { exact: true }).fill('Queue reinforcements');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.down('ControlRight');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyR');
  await expect(dialog.getByRole('status')).toContainText('Right Ctrl');
  await expect(dialog.getByRole('status')).toContainText('Left Shift');
  await page.keyboard.up('KeyR');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ControlRight');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(id);
  await page.getByLabel('Search commands or keys').fill('queue reinforcements');
  await expect(page.locator('.search-status')).toHaveText('3 matching keys');
  await key(page, '2-4').scrollIntoViewIfNeeded();
  await key(page, '2-4').focus();
  await expect(page.getByRole('tooltip')).toContainText('R + Right Ctrl + Left Shift: Queue reinforcements');
  await expect(key(page, '5-7')).toHaveClass(/key-combo-highlight/);
  await expect(key(page, '4-0')).toHaveClass(/key-combo-highlight/);
  await key(page, '4-0').focus();
  await expect(key(page, '2-4')).toHaveClass(/key-combo-highlight/);
  await expect(key(page, '5-7')).toHaveClass(/key-combo-highlight/);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const editor = await openKey(page, '2-4');
  await expect(editor.getByRole('textbox', { name: 'R + Right Ctrl + Left Shift action', exact: true })).toHaveValue('Queue reinforcements');
  await editor.getByRole('button', { name: 'Remove R + Right Ctrl + Left Shift combination', exact: true }).click();
  await editor.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await storedPresets(page)).find((preset) => preset.id === id)!.rows[2][4].combinations).toEqual([
    { keyId: '5-7', additionalKeyIds: ['4-0'], action: 'Queue reinforcements' },
  ]);
});

test('recording navigation keys does not close the dialog or move focus and unrelated typing is ignored', async ({ page }) => {
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add hotkey', exact: true });
  await dialog.getByLabel('Command', { exact: true }).fill('Navigation command');
  await expect(dialog.getByRole('status')).toHaveText('No hotkey recorded');
  for (const [code, label] of [['Tab', 'Tab'], ['Escape', 'Esc'], ['Enter', 'Enter'], ['Space', 'Space'], ['F1', 'F1']]) {
    const record = dialog.getByRole('button', { name: 'Record hotkey', exact: true });
    await record.click();
    await page.keyboard.press(code);
    await expect(dialog).toBeVisible();
    await expect(record).toBeFocused();
    await expect(dialog.getByRole('status')).toHaveText(label);
  }
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add hotkey', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Edit preset', exact: true })).toBeVisible();
});

test('unsupported keys clear the recording, conflicts require replacement, and draft cancellation preserves saved data', async ({ page }) => {
  const id = await makeCustom(page);
  const before = (await storedPresets(page)).find((preset) => preset.id === id)!;
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add hotkey', exact: true });
  await dialog.getByLabel('Command', { exact: true }).fill('Custom attack');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.press('KeyA');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.press('ControlLeft+Numpad1');
  await expect(dialog.getByRole('alert')).toContainText('cannot be matched');
  await expect(dialog.getByRole('status')).toHaveText('No hotkey recorded');
  await expect(dialog.getByRole('button', { name: 'Add hotkey', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.down('ControlLeft');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('ControlLeft');
  await expect(dialog.getByRole('alert')).toContainText('Recording stopped');
  await expect(dialog.getByRole('status')).toHaveText('No hotkey recorded');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.press('ControlLeft+KeyA');
  await expect(dialog).toContainText('Already assigned to “Select all units on screen”');
  await dialog.getByRole('button', { name: 'Replace hotkey', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await storedPresets(page)).find((preset) => preset.id === id)).toEqual(before);
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  await dialog.getByLabel('Command', { exact: true }).fill('Updated selection');
  await dialog.getByRole('button', { name: 'Record hotkey', exact: true }).click();
  await page.keyboard.press('ControlLeft+KeyA');
  await dialog.getByRole('button', { name: 'Replace hotkey', exact: true }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  const saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.rows[3][1].hotkeys).toEqual(['Attack Move']);
  expect(saved.rows[3][1].combinations).toEqual([{ keyId: '5-0', action: 'Updated selection' }]);
});

test('export and import round trip the layout with a fresh custom ID', async ({ page }) => {
  const id = await makeCustom(page, 'Backup preset');
  const original = (await storedPresets(page)).find((preset) => preset.id === id)!;
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export preset' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('rts-keymap-backup-preset.json');
  const text = await readFile((await download.path())!, 'utf8');
  await page.getByLabel('Import preset JSON').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(status(page)).toHaveText('Imported 1 preset as new custom copy.');
  const importedId = await page.getByLabel('Active layout').inputValue();
  expect(importedId).not.toBe(id);
  const imported = (await storedPresets(page)).find((preset) => preset.id === importedId)!;
  expect(imported.rows).toEqual(original.rows);
  expect(imported.name).toBe(original.name);
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(importedId);
  expect((await storedPresets(page)).filter((preset) => preset.id !== 'aoe4-default')).toHaveLength(2);
});

test('malformed imports and invalid combinations leave all existing presets untouched and can be retried', async ({ page }) => {
  const before = await storedPresets(page);
  const upload = page.getByLabel('Import preset JSON');
  await upload.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(status(page)).toContainText('not valid JSON');
  expect(await storedPresets(page)).toEqual(before);
  const invalid = structuredClone(defaultPresets[0]);
  invalid.rows[3][1].combinations![0].keyId = '3-1';
  await upload.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([defaultPresets[0], invalid])) });
  await expect(status(page)).toContainText('cannot target itself');
  expect(await storedPresets(page)).toEqual(before);
  await upload.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(defaultPresets[0])) });
  await expect(status(page)).toContainText('Imported 1 preset');
  await expect(page.getByRole('button', { name: 'New preset' })).toBeEnabled();
});

test('deletion requires confirmation, restores focus on cancel, and persists after reload', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Delete preset', exact: true })).toHaveCount(0);
  const id = await makeCustom(page, 'Delete check');
  await page.getByRole('button', { name: 'Delete preset', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete preset?' });
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete preset', exact: true })).toBeFocused();
  expect((await storedPresets(page)).some((preset) => preset.id === id)).toBe(true);
  await page.getByRole('button', { name: 'Delete preset', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete preset', exact: true }).click();
  await expect(status(page)).toHaveText('Deleted Delete check');
  await expect(page.getByLabel('Active layout')).toBeFocused();
  expect((await storedPresets(page)).some((preset) => preset.id === id)).toBe(false);
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await expect(page.getByLabel('Active layout').locator(`option[value="${id}"]`)).toHaveCount(0);
});

test('failed saves and deletes preserve data and allow retry', async ({ page }) => {
  const id = await makeCustom(page, 'Error check');
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Recovered check');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
      IDBObjectStore.prototype.put = put;
      return request;
    };
  });
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toContainText('Could not save preset');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Recovered check');
  expect((await storedPresets(page)).find((preset) => preset.id === id)!.name).toBe('Error check');
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      const request = remove.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
      IDBObjectStore.prototype.delete = remove;
      return request;
    };
  });
  await page.getByRole('button', { name: 'Delete preset', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete preset', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not delete preset');
  expect((await storedPresets(page)).some((preset) => preset.id === id)).toBe(true);
  await dialog.getByRole('button', { name: 'Delete preset', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await storedPresets(page)).some((preset) => preset.id === id)).toBe(false);
});

test('the keyboard scrolls at full key size and dialogs fit small viewports with keyboard focus contained', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.keyboard-frame').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await key(page, '2-1').evaluate((element) => element.getBoundingClientRect().width)).toBe(64);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const dialog = await openKey(page, '5-7');
  await expect(dialog).toHaveAccessibleName('Edit Right Ctrl');
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(500);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(key(page, '5-7')).toBeFocused();
});

test('bundled saves remain temporary while Save as custom persists', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Temporary name');
  await page.getByRole('button', { name: 'Save for this session' }).click();
  await expect(status(page)).toContainText('Bundled edits reset after reload');
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await expect(page.locator('.keyboard-heading h2')).toHaveText('Age of Empires IV Default');
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await page.getByRole('button', { name: 'Save as custom' }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  const id = await page.getByLabel('Active layout').inputValue();
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(id);
  await expect(page.locator('.keyboard-heading h2')).toHaveText('Age of Empires IV Default (Custom)');
});

test('database open errors remain visible in the live status message', async ({ page }) => {
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Storage unavailable', 'SecurityError'); }; });
  await page.reload();
  await expect(status(page)).toHaveText('Could not open local database');
  await expect(status(page)).toHaveAttribute('aria-live', 'polite');
});

test('saving locks editing and cancellation until commit and ignores repeated clicks', async ({ page }) => {
  const id = await makeCustom(page);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Committed name');
  await openKey(page);
  await page.getByRole('textbox', { name: 'Q hotkeys' }).fill(' \n\n ');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.evaluate(() => {
    let hold = true;
    window.addEventListener('release-test-writes', () => { hold = false; }, { once: true });
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const current = transaction.apply(this, args);
      if (args[1] === 'readwrite') {
        IDBDatabase.prototype.transaction = transaction;
        const pump = () => { if (hold) current.objectStore('presets').get('__test_keepalive__').onsuccess = pump; };
        pump();
      }
      return current;
    };
    const put = IDBObjectStore.prototype.put;
    document.documentElement.dataset.testPuts = '0';
    IDBObjectStore.prototype.put = function (...args) {
      document.documentElement.dataset.testPuts = String(Number(document.documentElement.dataset.testPuts) + 1);
      return put.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Save preset', exact: true }).evaluate((element) => { element.click(); element.click(); });
  await expect(status(page)).toHaveText('Saving preset...');
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(key(page, '2-1')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.dataset.testPuts)).toBe('1');
  await page.evaluate(() => window.dispatchEvent(new Event('release-test-writes')));
  await expect(status(page)).toHaveText('Saved preset to local database');
  const saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.name).toBe('Committed name');
  expect(saved.rows[2][1].hotkeys).toEqual(['']);
});

test('an aborted batch import does not leave partial copies and can be retried', async ({ page }) => {
  const before = await storedPresets(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
      IDBObjectStore.prototype.put = put;
      return request;
    };
  });
  const file = { name: 'batch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([defaultPresets[0], defaultPresets[0]])) };
  await page.getByLabel('Import preset JSON').setInputFiles(file);
  await expect(status(page)).toContainText('Could not import presets');
  expect(await storedPresets(page)).toEqual(before);
  await page.getByLabel('Import preset JSON').setInputFiles(file);
  await expect(status(page)).toHaveText('Imported 2 presets as new custom copies.');
  expect(await storedPresets(page)).toHaveLength(before.length + 2);
});

test('legacy invalid combinations are preserved, displayed, and can be repaired individually', async ({ page }) => {
  const legacy = structuredClone(defaultPresets[0]);
  legacy.id = 'custom-legacy';
  legacy.name = 'Legacy preset';
  legacy.rows[3][1].combinations = [
    { keyId: '3-1', action: 'Self action' },
    { keyId: '5-0', action: 'First duplicate' },
    { keyId: '5-0', action: 'Second duplicate' },
    { keyId: '6-0', action: 'Spacer action' },
    { keyId: '99-0', action: 'Missing action' },
  ];
  await page.evaluate((preset) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('rts-keymap-viewer', 1);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('presets', 'readwrite');
      transaction.objectStore('presets').put(preset);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }), legacy);
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await page.getByLabel('Active layout').selectOption(legacy.id);
  await expect(page.locator('.preset-validation li')).toHaveCount(4);
  expect((await storedPresets(page)).find((preset) => preset.id === legacy.id)!.rows[3][1].combinations).toHaveLength(5);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const dialog = await openKey(page, '3-1');
  await expect(dialog.locator('.combo-editor li')).toHaveCount(5);
  await dialog.getByRole('button', { name: 'Remove A + Left Ctrl combination' }).first().click();
  await expect(dialog.locator('.combo-editor li')).toHaveCount(4);
  while (await dialog.getByRole('button', { name: /^Remove/ }).count()) await dialog.getByRole('button', { name: /^Remove/ }).first().click();
  await dialog.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  expect((await storedPresets(page)).find((preset) => preset.id === legacy.id)!.rows[3][1].combinations).toHaveLength(0);
});
