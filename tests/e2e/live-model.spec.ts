import { expect, test } from '@playwright/test';

test.skip(
  !process.env.RUN_LIVE_MODEL,
  'Set RUN_LIVE_MODEL=1 for the large network-backed smoke test.',
);

test('runs, branches, exports, imports and replays verified WASM steps', async ({ page }) => {
  test.setTimeout(480_000);
  await page.goto('/');

  await page.getByRole('button', { name: 'Load verified WASM' }).click();
  const start = page.getByRole('button', { name: 'Start new baseline' });
  const failure = page.getByRole('alert');
  await expect
    .poll(
      async () => {
        if (await failure.isVisible()) {
          throw new Error(`Local model load failed: ${await failure.innerText()}`);
        }
        return start.isEnabled();
      },
      { timeout: 240_000 },
    )
    .toBe(true);
  await start.click();

  await expect(page.getByText('50,257 complete logits')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Verified measured output/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Logit' })).toBeVisible();

  await expect(page.getByText('paused-before-selection', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 2/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 3/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 4/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 5/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 6/)).toBeVisible({ timeout: 60_000 });

  await page.getByLabel('Historical baseline step').selectOption('2');
  await page.getByRole('button', { name: 'Fork decoded alternative' }).click();
  await expect(page.getByText(/First selection divergence: step 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue selected trace' }).click();
  await expect(page.getByText(/Paused before selection 4/)).toBeVisible({ timeout: 60_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ancestry bundle' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.observatory-bundle\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  if (!path) throw new Error('Playwright did not expose the downloaded trace path.');
  await page.getByLabel('Import 1.0 / 1.1 / 1.2').setInputFiles(path);
  await expect(page.getByText(/effective steps replayed exactly/)).toBeVisible();
});
