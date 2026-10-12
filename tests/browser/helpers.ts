import { test, expect, type Page } from '@playwright/test';
import type { KeyboardPreset } from '../../src/data/presets';

export const key = (page: Page, id: string) => page.locator(`.key[data-key-position="${id}"]`);
export const status = (page: Page) => page.locator('.database-status');
const pageErrors = new WeakMap<Page, string[]>();

export async function storedPresets(page: Page): Promise<KeyboardPreset[]> {
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

export async function enterEditor(page: Page) {
  const link = page.getByRole('link', { name: /^Edit/ });
  if (await link.getAttribute('aria-current') !== 'page') await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}

export async function manage(page: Page) {
  const details = page.locator('.preset-management');
  if (!await details.evaluate((element) => (element as HTMLDetailsElement).open)) await details.locator('summary').click();
}

export async function cancelDraft(page: Page) {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  if (await dialog.count()) await dialog.getByRole('button', { name: 'Discard changes' }).click();
}

export async function makeCustom(page: Page, name = 'Browser preset') {
  await page.getByRole('button', { name: 'Clone preset' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  return page.getByLabel('Active layout').inputValue();
}

export async function openKey(page: Page, id = '2-1') {
  await key(page, id).scrollIntoViewIfNeeded();
  await key(page, id).focus();
  await page.keyboard.press('Enter');
  return page.getByRole('dialog');
}

export function installBrowserChecks(editor = true) {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('./');
    await expect(status(page)).toHaveText('Loaded from local database');
    if (editor) await enterEditor(page);
  });

  test.afterEach(async ({ page }) => {
    expect(pageErrors.get(page)).toEqual([]);
  });
}
