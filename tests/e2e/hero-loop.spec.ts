import { expect, test } from '@playwright/test';

test('forces the runner-up into an immutable comparison branch', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Observe. Intervene. Compare.',
  );
  await expect(page.getByText('Sampler exact', { exact: true })).toBeVisible();
  await expect(page.getByText('Complete 10-candidate teaching universe')).toBeVisible();

  await page.getByRole('button', { name: 'Force runner-up branch' }).click();

  await expect(page.getByRole('button', { name: /B1.*Forced.*dark/s })).toBeVisible();
  await expect(page.getByLabel('Compared selected tokens')).toContainText('clear');
  await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');
  await expect(page.getByText('step 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/Branch 1 committed/)).toBeVisible();
});

test('supports reversible calibration before a branch is committed', async ({ page }) => {
  await page.goto('/');

  const temperature = page.getByRole('slider', { name: 'Temperature' });
  await temperature.fill('1.5');
  await expect(page.getByText('1.50', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Suppress', exact: true }).first().click();
  await expect(page.getByLabel(/Rank 1.*suppressed manually/)).toBeVisible();
  await page.getByRole('button', { name: /Commit branch 1/ }).click();

  await expect(page.getByRole('button', { name: /B1.*Suppressed 1 candidate/s })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected trace JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.observatory-trace\.json$/);
});

test('compares the greedy baseline with a seeded stochastic branch', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Seed').fill('0');
  await page.getByRole('button', { name: /Commit branch 1/ }).click();

  await expect(page.getByLabel('Compared selected tokens')).toContainText('clear');
  await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');
  await expect(page.getByText('step 1', { exact: true })).toBeVisible();
});

test('keeps the instrument usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Probability spectrometer' })).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
