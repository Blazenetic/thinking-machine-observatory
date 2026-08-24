import { expect, test } from '@playwright/test';

test.skip(
  !process.env.RUN_LIVE_MODEL,
  'Set RUN_LIVE_MODEL=1 for the large network-backed smoke test.',
);

test('captures genuine top logits through the pinned WASM worker', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');

  await page.getByRole('button', { name: 'Load with WASM' }).click();
  const measure = page.getByRole('button', { name: 'Measure next-token logits' });
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

  await expect(page.getByText('20 captured logits')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Live measured output, unverified build/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Logit' })).toBeVisible();
});
