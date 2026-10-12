import { test, expect } from '@playwright/test';
import { enterEditor, installBrowserChecks, key, openKey, status } from './helpers';

installBrowserChecks(false);

test('the main screen exposes only viewing controls and keyboard keys', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'View', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('button:not(.key)')).toHaveCount(0);
  await expect(page.locator('.preset-management')).toHaveCount(0);
  await expect(page.getByLabel('Active layout')).toBeEnabled();
  await key(page, '3-1').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tooltip')).toContainText('Attack Move');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search commands or keys').fill('Ctrl+A');
  const result = page.getByRole('list', { name: 'Matching commands' }).getByRole('link');
  await expect(result).toContainText('Select all units on screen');
  await result.click();
  await expect(key(page, '3-1')).toBeFocused();
  await expect(page.locator('button:not(.key)')).toHaveCount(0);
  await page.getByLabel('Search commands or keys').focus();
  await page.keyboard.press('Enter');
  await expect(key(page, '3-1')).toBeFocused();
  await page.getByLabel('Search commands or keys').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Search commands or keys')).toHaveValue('');
  await expect(page.getByRole('list', { name: 'Matching commands' })).toHaveCount(0);
});

test('edit actions are isolated and switching to View retains the draft without displaying its changes', async ({ page }) => {
  await enterEditor(page);
  await expect(page.getByRole('button', { name: 'Add hotkey', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clone preset' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit preset', exact: true }).click();
  await openKey(page);
  await page.getByRole('textbox', { name: 'Q hotkeys' }).fill('Editor draft command');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.locator('button:not(.key)')).toHaveCount(0);
  await expect(page.getByLabel('Active layout')).toBeDisabled();
  await key(page, '2-1').focus();
  await expect(page.getByRole('tooltip')).toContainText('Scout');
  await expect(page.getByRole('tooltip')).not.toContainText('Editor draft command');
  await enterEditor(page);
  await openKey(page);
  await expect(page.getByRole('textbox', { name: 'Q hotkeys' })).toHaveValue('Editor draft command');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save as custom' }).click();
  await expect(status(page)).toHaveText('Saved preset to local database');
  await page.getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.getByLabel('Active layout')).toBeEnabled();
  await key(page, '2-1').focus();
  await expect(page.getByRole('tooltip')).toContainText('Editor draft command');
});

test('recovery and storage failure do not reintroduce main-screen action buttons', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('rts-keymap-draft', JSON.stringify({ preset: {
      id: 'custom-recovery', name: 'Recovery test', game: 'Test', rows: [[{ label: 'A', hotkeys: ['Recovered command'] }]],
    }, activePresetId: 'aoe4-default' }));
  });
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Storage unavailable', 'SecurityError'); }; });
  await page.reload();
  await expect(status(page)).toHaveText('Could not open local database');
  await expect(page.getByRole('region', { name: 'Recovered draft' })).toContainText('Recovery test');
  await expect(page.locator('button:not(.key)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry storage' })).toHaveCount(0);
  await enterEditor(page);
  await expect(page.getByRole('button', { name: 'Retry storage' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore draft' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Discard recovery' })).toBeVisible();
});

test('browser back closes editor dialogs and returns to the viewing screen', async ({ page }) => {
  await enterEditor(page);
  await page.getByRole('button', { name: 'Add hotkey', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Command', { exact: true }).fill('Unsubmitted command');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('button:not(.key)')).toHaveCount(0);
  await enterEditor(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
