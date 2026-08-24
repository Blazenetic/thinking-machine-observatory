import { expect, test } from '@playwright/test';

test.skip(
  !process.env.RUN_LIVE_MODEL,
  'Set RUN_LIVE_MODEL=1 for the large network-backed smoke test.',
);

test('commits, exports, imports and replays the verified WASM vocabulary', async ({ page }) => {
  test.setTimeout(480_000);
  await page.goto('/');

  await page.getByRole('button', { name: 'Load verified WASM' }).click();
  const measure = page.getByRole('button', { name: 'Measure full vocabulary' });
  const failure = page.getByRole('alert');
  await expect
    .poll(
      async () => {
        if (await failure.isVisible()) {
          throw new Error(`Local model load failed: ${await failure.innerText()}`);
        }
        return measure.isEnabled();
      },
      { timeout: 240_000 },
    )
    .toBe(true);
  await measure.click();

  await expect(page.getByText('50,257 complete logits')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Verified measured output/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Logit' })).toBeVisible();

  await page.getByRole('button', { name: 'Commit verified trace' }).click();
  await expect(page.getByText(/Committed and replayed token/)).toBeVisible();
  await expect(page.getByText('Replay exact')).toBeVisible();
  await expect(page.getByText('Candidate records').locator('..')).toContainText('50,257');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export trace JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.observatory-trace\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  if (!path) throw new Error('Playwright did not expose the downloaded trace path.');
  await page.getByLabel('Import and replay JSON').setInputFiles(path);
  await expect(page.getByText(/every recorded step replayed exactly/)).toBeVisible();
});
