import { test, expect } from '@playwright/test';
import { enterEditor, installBrowserChecks, key, makeCustom, manage, status } from './helpers';

installBrowserChecks(false);

test('Print reference button calls window.print from View and Edit screens', async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls++;
    };
  });

  const viewPrintButton = page.getByRole('button', { name: 'Print reference', exact: true });
  await expect(viewPrintButton).toBeVisible();
  await expect(viewPrintButton).toBeEnabled();
  await viewPrintButton.click();
  expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);

  await enterEditor(page);
  await manage(page);
  const editPrintButton = page.locator('.preset-library').getByRole('button', { name: 'Print reference', exact: true });
  await expect(editPrintButton).toBeVisible();
  await expect(editPrintButton).toBeEnabled();
  await editPrintButton.click();
  expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(2);
});

test('print stylesheet hides screen-only UI and reveals the print cheat sheet', async ({ page }) => {
  // On screen, print elements are hidden
  await expect(page.locator('.print-header')).toBeHidden();
  await expect(page.locator('.print-legend')).toBeHidden();
  await expect(page.locator('.print-command-list')).toBeHidden();
  await expect(key(page, '2-1').locator('.key-inline-command')).toBeHidden();

  // Emulate print media
  await page.emulateMedia({ media: 'print' });

  // Screen-only UI is hidden
  await expect(page.locator('.app-header')).toBeHidden();
  await expect(page.locator('.screen-nav')).toBeHidden();
  await expect(page.locator('.preset-panel')).toBeHidden();
  await expect(page.locator('.command-search')).toBeHidden();
  await expect(page.locator('.status-row')).toBeHidden();
  await expect(page.locator('.board-hint')).toBeHidden();
  await expect(page.locator('.board-footer')).toBeHidden();
  await expect(page.locator('.keyboard-heading')).toBeHidden();

  // Print cheat sheet header is visible
  const printHeader = page.locator('.print-header');
  await expect(printHeader).toBeVisible();
  await expect(printHeader.locator('.print-title')).toHaveText('Age of Empires IV Default');
  await expect(printHeader.locator('.print-game-badge')).toHaveText('Age of Empires IV');
  await expect(printHeader.locator('.print-meta')).toContainText('keys');
  await expect(printHeader.locator('.print-meta')).toContainText('commands');

  // Print legend is visible
  await expect(page.locator('.print-legend')).toBeVisible();

  // Keyboard is visible and displays commands inline
  await expect(page.locator('.keyboard')).toBeVisible();
  const qKey = key(page, '2-1');
  await expect(qKey.locator('.key-label')).toHaveText('Q');
  await expect(qKey.locator('.key-inline-command')).toBeVisible();
  await expect(qKey.locator('.key-inline-command')).toHaveText('Scout');

  const aKey = key(page, '3-1');
  await expect(aKey.locator('.key-label')).toHaveText('A');
  await expect(aKey.locator('.key-inline-command')).toBeVisible();
  await expect(aKey.locator('.key-inline-command')).toHaveText('Attack Move');

  // Unassigned keys have no inline command
  const dashKey = key(page, '1-11');
  await expect(dashKey.locator('.key-inline-command')).toHaveCount(0);

  // Grouped command list is visible and organized by category
  const commandList = page.locator('.print-command-list');
  await expect(commandList).toBeVisible();
  await expect(commandList.locator('.print-section-heading')).toContainText('Commands by Category');

  const categoryGroups = commandList.locator('.print-category-group');
  expect(await categoryGroups.count()).toBeGreaterThan(3);

  // Selection category contains expected commands
  const selectionGroup = categoryGroups.filter({ hasText: 'Selection' });
  await expect(selectionGroup).toBeVisible();
  await expect(selectionGroup.locator('.print-table-shortcut kbd', { hasText: 'Tab' })).toBeVisible();
  await expect(selectionGroup.locator('.print-table-action', { hasText: 'Cycle through selected unit types (forward)' })).toBeVisible();

  // Combination shortcut displays with modifiers first
  await expect(selectionGroup.locator('.print-table-shortcut kbd', { hasText: /Ctrl \+ A/ })).toBeVisible();
  await expect(selectionGroup.locator('.print-table-action', { hasText: 'Select all units on screen' })).toBeVisible();
});

test('print stylesheet renders clean black and white styles across themes', async ({ page }) => {
  for (const theme of ['midnight', 'forest', 'ember']) {
    await page.getByLabel('Colour theme').selectOption(theme);

    await page.emulateMedia({ media: 'print' });

    // Document background is pure white
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)']).toContain(bodyBg);

    // Key has white background and black text
    const keyStyles = await key(page, '2-1').evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        bg: style.backgroundColor,
        color: style.color,
      };
    });
    expect(keyStyles.bg).toBe('rgb(255, 255, 255)');
    expect(keyStyles.color).toBe('rgb(0, 0, 0)');

    // Reset back to screen media for next theme
    await page.emulateMedia({ media: 'screen' });
  }
});

test('custom presets print their custom title and inline commands', async ({ page }) => {
  await enterEditor(page);
  await makeCustom(page, 'My Custom Layout');

  await page.getByRole('link', { name: 'View', exact: true }).click();
  await page.emulateMedia({ media: 'print' });

  const printHeader = page.locator('.print-header');
  await expect(printHeader.locator('.print-title')).toHaveText('My Custom Layout');
  await expect(key(page, '2-1').locator('.key-inline-command')).toHaveText('Scout');
});

test('wide imported boards scale every row to the printable width', async ({ page }) => {
  await page.setViewportSize({ width: 718, height: 1000 });
  await enterEditor(page);
  await manage(page);
  const commandKey = (label: string, width = 1, height = 1) => ({ label, width, height, hotkeys: ['Command'] });
  const layouts = [
    [Array.from({ length: 19 }, (_, index) => commandKey(`Key ${index}`))],
    [
      [commandKey('Tall', 2.5, 2), { label: '', width: 30, spacer: true, hotkeys: [''] }, commandKey('End', 30)],
      Array.from({ length: 497 }, (_, index) => commandKey(`Tiny ${index}`, 0.01)),
    ],
  ];

  for (const [index, rows] of layouts.entries()) {
    await page.getByLabel('Import preset JSON').setInputFiles({
      name: 'wide.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ id: 'wide', name: `Wide ${index}`, game: 'Test', rows })),
    });
    await expect(status(page)).toContainText('Imported 1 preset');

    for (const screen of ['View', 'Edit']) {
      await page.getByRole('link', { name: screen, exact: true }).click();
      await page.emulateMedia({ media: 'print' });
      const bounds = await page.locator('.keyboard-frame').evaluate((frame) => {
        const area = frame.getBoundingClientRect();
        const board = frame.querySelector('.keyboard')!.getBoundingClientRect();
        return {
          left: area.left,
          right: area.right,
          boardBottom: board.bottom,
          listTop: document.querySelector('.print-command-list')!.getBoundingClientRect().top,
          keys: [...frame.querySelectorAll('.key, .keyboard-spacer')].map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          }),
        };
      });
      expect(bounds.right - bounds.left).toBeLessThanOrEqual(718);
      expect(bounds.keys).toHaveLength(rows.flat().length);
      for (const rect of bounds.keys) {
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
        expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
      }
      expect(bounds.listTop).toBeGreaterThan(bounds.boardBottom);
      await expect(page.locator('.print-title')).toHaveText(`Wide ${index}`);
      await page.emulateMedia({ media: 'screen' });
    }
    await manage(page);
  }
});
