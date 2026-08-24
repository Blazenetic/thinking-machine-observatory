import { expect, test } from '@playwright/test';

test('exposes named controls, valid references and readable table alternatives', async ({
  page,
}) => {
  await page.goto('/');

  const issues = await page.evaluate(() => {
    const findings: string[] = [];
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    for (const id of new Set(ids)) {
      if (ids.filter((candidate) => candidate === id).length > 1)
        findings.push(`duplicate id ${id}`);
    }

    for (const element of document.querySelectorAll<HTMLElement>('[aria-labelledby]')) {
      for (const id of (element.getAttribute('aria-labelledby') ?? '').split(/\s+/)) {
        if (id && !document.getElementById(id)) findings.push(`missing labelledby target ${id}`);
      }
    }

    for (const table of document.querySelectorAll('table')) {
      const caption = table.querySelector('caption');
      if (!caption?.textContent?.trim()) findings.push('table without a caption');
    }

    const controls = document.querySelectorAll<HTMLElement>(
      'button, summary, select, textarea, input:not([type="hidden"])',
    );
    for (const control of controls) {
      if ('disabled' in control && control.disabled) continue;
      const id = control.id;
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrappingLabel = control.closest('label');
      const name =
        control.getAttribute('aria-label') ??
        (control.getAttribute('aria-labelledby')
          ? document.getElementById(control.getAttribute('aria-labelledby')!)?.textContent
          : null) ??
        label?.textContent ??
        wrappingLabel?.textContent ??
        control.textContent;
      if (!name?.trim()) findings.push(`unnamed ${control.tagName.toLowerCase()}`);
    }
    return findings;
  });

  expect(issues).toEqual([]);
});

test('completes the first experiment and export using keyboard activation', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to observation floor' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#observation-floor')).toBeFocused();

  const intervention = page.getByRole('button', { name: 'Force runner-up branch' });
  await intervention.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');

  const reflection = page.getByLabel('Reflection · append-only trace annotation').first();
  await reflection.focus();
  await page.keyboard.type('The sampler override changed the selected token, not model intent.');
  const append = page.getByRole('button', { name: 'Append reflection to trace' }).first();
  await append.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/sampler override changed/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  const exportButton = page.getByRole('button', { name: 'Export selected trace JSON' });
  await exportButton.focus();
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.observatory-trace\.json$/);
});

test('keeps focus visible and interactive targets at least 24 CSS pixels', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Force runner-up branch' });
  await button.focus();
  const focus = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    return { offset: style.outlineOffset, style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focus.style).not.toBe('none');
  expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(2);

  const undersized = await page.locator('button:enabled, summary').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 24 || rect.height < 24
        ? [`${element.tagName.toLowerCase()}:${element.textContent?.trim().slice(0, 40)}`]
        : [];
    }),
  );
  expect(undersized).toEqual([]);
});

test('honours reduced motion and remains usable at 200 percent zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto('/');

  const motion = await page
    .locator('.candidate-row__bar')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animation: style.animationDuration,
        scroll: getComputedStyle(document.documentElement).scrollBehavior,
      };
    });
  expect(Number.parseFloat(motion.animation)).toBeLessThanOrEqual(0.01);
  expect(motion.scroll).toBe('auto');

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: 'Probability spectrometer' })).toBeVisible();
});

test('uses forced-colour outlines without hiding evidence labels', async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== 'chromium', 'Forced-colour emulation is recorded in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Force runner-up branch' }).click();

  const activeBranch = page.getByRole('button', { name: /B1.*Forced.*dark/s });
  await expect(activeBranch).toBeVisible();
  const outline = await activeBranch.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await expect(page.getByText('Interventional', { exact: true }).first()).toBeVisible();
});

test('revisits the illustrative instrument offline after the shell is cached', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
    }
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Observe. Intervene. Compare.',
    );
    await page.getByRole('button', { name: 'Force runner-up branch' }).click();
    await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');
  } finally {
    await context.setOffline(false);
  }
});
