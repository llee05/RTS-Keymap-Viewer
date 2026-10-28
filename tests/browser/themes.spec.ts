import { test, expect } from '@playwright/test';
import { enterEditor, installBrowserChecks, key, openKey, status, storedPresets } from './helpers';

installBrowserChecks(false);

test('themes recolour the board and portals, persist, and preserve preset data', async ({ page }) => {
  const before = await storedPresets(page);
  const picker = page.getByLabel('Colour theme');
  await picker.focus();
  await expect(picker).toBeFocused();
  await expect(picker).toHaveValue('midnight');
  const backgrounds = new Set<string>();
  for (const theme of ['forest', 'ember', 'midnight']) {
    await picker.selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    backgrounds.add(await key(page, '2-1').evaluate((element) => getComputedStyle(element).backgroundImage));
    await key(page, '2-1').focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    expect(await page.getByRole('tooltip').evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(await page.locator('.preset-panel').evaluate((element) => getComputedStyle(element).backgroundColor));
    await page.reload();
    await expect(status(page)).toHaveText('Loaded from local database');
    await expect(picker).toHaveValue(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  expect(backgrounds.size).toBe(3);
  expect(await storedPresets(page)).toEqual(before);

  await picker.selectOption('ember');
  await enterEditor(page);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await openKey(page);
  expect(await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(await page.locator('.preset-panel').evaluate((element) => getComputedStyle(element).backgroundColor));
});

test('unknown or unavailable theme storage falls back safely and still allows switching', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('rts-keymap-theme', 'unknown'));
  await page.reload();
  await expect(page.getByLabel('Colour theme')).toHaveValue('midnight');
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
  });
  await page.reload();
  await expect(status(page)).toHaveText('Loaded from local database');
  await expect(page.getByLabel('Colour theme')).toHaveValue('midnight');
  await page.getByLabel('Colour theme').selectOption('forest');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
});

test('themes keep narrow layouts contained and the keyboard scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const theme of ['midnight', 'forest', 'ember']) {
    await page.getByLabel('Colour theme').selectOption(theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const frame = page.locator('.keyboard-frame');
    expect(await frame.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await frame.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    expect(await frame.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await key(page, '0-0').focus();
    await page.keyboard.press('ArrowRight');
    await expect(key(page, '0-2')).toBeFocused();
    await expect(page.getByRole('tooltip')).toBeVisible();
  }
  await enterEditor(page);
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Edit/ })).toContainText('Unsaved');
  for (const width of [320, 390, 700]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['midnight', 'forest', 'ember']) {
      await page.getByLabel('Colour theme').selectOption(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const editLink = await page.getByRole('link', { name: /^Edit/ }).boundingBox();
      const themePicker = await page.getByLabel('Colour theme').boundingBox();
      expect(editLink).not.toBeNull();
      expect(themePicker).not.toBeNull();
      const editRight = Math.round(editLink!.x + editLink!.width);
      const pickerLeft = Math.round(themePicker!.x);
      // Ensure navigation and theme controls do not overlap on narrow viewports regardless of font metrics.
      expect(editRight).toBeLessThanOrEqual(pickerLeft);
    }
  }
});
