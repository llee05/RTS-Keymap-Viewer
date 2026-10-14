import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { key, status, makeCustom, manage, openKey, storedPresets, installBrowserChecks } from './helpers';

installBrowserChecks();

test('command results understand shortcut notation and reveal incoming combinations', async ({ page }) => {
  await page.getByLabel('Search commands or keys').fill('Control+A');
  await expect(page.locator('.search-status')).toHaveText('1 matching command');
  await expect(page.getByRole('list', { name: 'Matching commands' })).toContainText('Left Ctrl + A');
  await page.getByRole('button', { name: /Select all units on screen.*Left Ctrl \+ A/ }).click();
  await expect(key(page, '3-1')).toBeFocused();
  await key(page, '5-0').focus();
  await expect(page.getByRole('tooltip')).toContainText('Select all units on screen');
  await expect(page.getByRole('tooltip')).toContainText('Select all idle Villagers');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByLabel('Command category', { exact: true }).selectOption('Camera');
  await expect(page.getByRole('list', { name: 'Matching commands' })).toContainText('Pan camera up');
  await expect(page.getByRole('list', { name: 'Matching commands' })).not.toContainText('Attack Move');
  await key(page, '0-0').focus();
  await page.keyboard.press('ArrowRight');
  await expect(key(page, '0-2')).toBeFocused();
  await page.keyboard.press('End');
  await expect(key(page, '0-15')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(key(page, '0-0')).toBeFocused();
  await key(page, '2-1').focus();
  await page.keyboard.press('ArrowDown');
  await expect(key(page, '3-1')).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await key(page, '3-1').evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
});

test('draft recovery preserves raw typing, undo and redo work, and saved selection survives reload', async ({ page }) => {
  const id = await makeCustom(page, 'Recovery original');
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await expect(page.locator('.draft-indicator')).toHaveText('No changes yet');
  await page.getByLabel('Name', { exact: true }).fill('  Recovered preset  ');
  await page.getByLabel('Game', { exact: true }).fill('  Test game  ');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Game', { exact: true })).toHaveValue('Age of Empires IV');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Game', { exact: true })).toHaveValue('  Test game  ');
  await openKey(page);
  await page.getByRole('textbox', { name: 'Commands for Q alone' }).fill('  Raw command  \n\nSecond ');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.locator('.draft-indicator')).toHaveText('Unsaved changes');
  let warned = false;
  page.once('dialog', async (dialog) => { warned = dialog.type() === 'beforeunload'; await dialog.accept(); });
  await page.reload();
  expect(warned).toBe(true);
  await expect(page.getByRole('region', { name: 'Recovered draft' })).toContainText('Recovered preset');
  await expect(page.getByLabel('Active layout')).toHaveValue(id);
  await page.getByRole('button', { name: 'Restore draft' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('  Recovered preset  ');
  await openKey(page);
  await expect(page.getByRole('textbox', { name: 'Commands for Q alone' })).toHaveValue('  Raw command  \n\nSecond ');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.reload();
  await expect(page.getByLabel('Active layout')).toHaveValue(id);
  await expect(page.locator('.keyboard-heading h2')).toHaveText('Recovered preset');
  await expect(page.getByRole('region', { name: 'Recovered draft' })).toHaveCount(0);
  const saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.game).toBe('Test game');
  expect(saved.rows[2][1].hotkeys).toEqual(['Raw command', 'Second']);
});

test('cancel requires explicit discard for changed drafts and keeps saved data intact', async ({ page }) => {
  const id = await makeCustom(page);
  const saved = (await storedPresets(page)).find((preset) => preset.id === id);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Do not discard yet');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Do not discard yet');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  expect((await storedPresets(page)).find((preset) => preset.id === id)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Recovered draft' })).toHaveCount(0);
});

test('blank layouts validate details and library backups preserve metadata through import', async ({ page }) => {
  await manage(page);
  await page.getByRole('button', { name: 'Blank preset', exact: true }).click();
  expect(await page.locator('.key-assigned-marker, .key-combination-marker').count()).toBe(0);
  await page.getByLabel('Name', { exact: true }).fill('   ');
  await page.getByLabel('Game', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Save preset', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#preset-name-error')).toHaveText('Enter a preset name.');
  await page.getByLabel('Name', { exact: true }).fill('  Blank backup  ');
  await page.getByLabel('Game', { exact: true }).fill('  Test  ');
  await page.locator('.preset-metadata summary').click();
  await page.getByLabel('Source', { exact: true }).fill('My game settings');
  await page.getByLabel('Version', { exact: true }).fill('Revision 2');
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await manage(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all presets', exact: true }).click();
  const download = await downloading;
  const backup = await readFile((await download.path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.presets).toHaveLength(2);
  expect(data.presets[1]).toMatchObject({ name: 'Blank backup', game: 'Test', source: 'My game settings', version: 'Revision 2' });
  await page.getByLabel('Import preset JSON').setInputFiles({ name: 'all.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(status(page)).toContainText('Imported 2 presets');
  const stored = await storedPresets(page);
  expect(stored.filter((preset) => preset.source === 'My game settings')).toHaveLength(2);
});

test('on-screen entry and participant editing support three-key shortcuts without a physical keyboard', async ({ page }) => {
  const id = await makeCustom(page);
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add hotkey', exact: true });
  await dialog.getByLabel('Command', { exact: true }).fill('Rally reinforcements');
  await dialog.getByLabel('Context (optional)', { exact: true }).fill('Combat');
  await dialog.getByLabel('Category (optional)', { exact: true }).fill('Units');
  await dialog.locator('.manual-keys summary').click();
  for (const label of ['Left Ctrl', 'Left Shift', 'R']) await dialog.locator('.key-picker-options').getByRole('button', { name: label, exact: true }).click();
  await dialog.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const editor = await openKey(page, '2-4');
  await editor.locator('.combination-details summary').click();
  await editor.locator('.combination-details .key-picker-options').getByRole('button', { name: 'Left Shift', exact: true }).click();
  await editor.locator('.combination-details .key-picker-options').getByRole('button', { name: 'Right Shift', exact: true }).click();
  await editor.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  const saved = (await storedPresets(page)).find((preset) => preset.id === id)!;
  expect(saved.rows[2][4].combinations![0]).toMatchObject({ keyId: '5-0', additionalKeyIds: ['4-11'], context: 'Combat', category: 'Units' });
  await key(page, '4-11').focus();
  await expect(page.getByRole('tooltip')).toContainText('Rally reinforcements (Combat)');
});

test('manual combinations warn about conflicts across owners and allow distinct contexts', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  const editor = await openKey(page, '5-0');
  await editor.getByLabel('Combination key', { exact: true }).selectOption('3-1');
  await editor.getByLabel('Combination command', { exact: true }).fill('Spectator selection');
  await expect(editor.getByRole('alert')).toContainText('repeated');
  await expect(editor.getByRole('button', { name: 'Add combination' })).toBeDisabled();
  await editor.getByLabel('Combination context (optional)', { exact: true }).fill('Spectator');
  await editor.getByRole('button', { name: 'Add combination' }).click();
  await editor.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save as custom' }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.getByLabel('Search commands or keys').fill('Ctrl+A');
  await expect(page.locator('.search-status')).toHaveText('2 matching commands');
  await expect(page.getByRole('list', { name: 'Matching commands' })).toContainText('Spectator');
});

test('the bundled board survives storage failure and Retry restores editing', async ({ page }) => {
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    window.addEventListener('restore-storage', () => { indexedDB.open = open; }, { once: true });
  });
  await page.reload();
  await expect(status(page)).toHaveText('Could not open local database');
  await expect(key(page, '3-1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit preset', exact: true })).toBeDisabled();
  await key(page, '3-1').focus();
  await expect(page.getByRole('tooltip')).toContainText('Attack Move');
  await page.evaluate(() => window.dispatchEvent(new Event('restore-storage')));
  await page.getByRole('button', { name: 'Retry storage' }).click();
  await expect(status(page)).toHaveText('Loaded from local database');
  await expect(page.getByRole('button', { name: 'Clone preset' })).toBeEnabled();
});

test('the mobile board is discoverable on first load and retains its legend and swipe hint', async ({ page }) => {
  await page.getByRole('link', { name: 'View', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.keyboard-frame').evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(600);
  await expect(page.getByLabel('Keyboard legend')).toBeVisible();
  await expect(page.locator('.swipe-hint')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export preset', exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed recovery storage reports the limitation while edits can still be saved', async ({ page }) => {
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === 'rts-keymap-draft') throw new DOMException('Quota full', 'QuotaExceededError');
      return set.call(this, name, value);
    };
  });
  await page.getByRole('button', { name: 'Clone preset' }).click();
  await expect(page.getByRole('alert')).toContainText('Draft recovery is unavailable');
  await page.getByLabel('Name', { exact: true }).fill('Still saved');
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  expect((await storedPresets(page)).some((preset) => preset.name === 'Still saved')).toBe(true);
});


test('large library backups offer explicit download parts that each remain importable', async ({ page }) => {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('rts-keymap-viewer', 1);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('presets', 'readwrite');
      for (let i = 0; i < 101; i++) transaction.objectStore('presets').put({
        id: `custom-part-${i}`, name: `Part preset ${i}`, game: 'Test', rows: [[{ label: 'A', hotkeys: [`Command ${i}`] }]],
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
    request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await manage(page);
  await page.getByRole('button', { name: 'Export all presets', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Download backup parts' });
  await expect(dialog).toBeVisible();
  const counts: number[] = [];
  for (let i = 1; i <= 2; i++) {
    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', { name: `Download part ${i}`, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`rts-keymap-all-presets-${i}.json`);
    const backup = await readFile((await download.path())!, 'utf8');
    counts.push(JSON.parse(backup).presets.length);
  }
  expect(counts).toEqual([100, 2]);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export all presets', exact: true })).toBeFocused();
});
