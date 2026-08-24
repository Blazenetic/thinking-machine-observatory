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

  const reflection = page.locator('#reflection-force-runner-up');
  const runnerUpExperiment = reflection.locator('xpath=ancestor::details');
  await expect(runnerUpExperiment).toHaveAttribute('open', '');
  await expect(reflection).toBeVisible();
  await reflection.focus();
  await page.keyboard.type('The sampler override changed the selected token, not model intent.');
  const append = page.locator('#append-reflection-force-runner-up');
  await expect(append).toBeEnabled();
  await expect(append).toBeVisible();
  await append.focus();
  await page.keyboard.press('Enter');
  await expect(runnerUpExperiment.getByText(/sampler override changed/)).toBeVisible();

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

test('honours reduced motion and remains usable at 200 percent reflow', async ({ page }) => {
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

  // Halving the CSS viewport is the portable automated proxy for reflow at 200% page zoom.
  // A named-browser manual zoom review remains a separate release-evidence record.
  await page.setViewportSize({ height: 720, width: 640 });
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
  await expect(
    page.locator('.branch-chamber').getByText('Interventional', { exact: true }),
  ).toBeVisible();
});

test('serves the illustrative instrument shell from cache while offline', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot drive an offline reload reliably.');
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

  const shellCached = await page.evaluate(async () => {
    const shellUrl = new URL('/', globalThis.location.href).href;
    return Boolean(await globalThis.caches.match(shellUrl));
  });
  expect(shellCached).toBe(true);

  await context.setOffline(true);
  try {
    const cachedShell = await page.evaluate(async () => {
      const response = await fetch('/');
      return { markup: await response.text(), ok: response.ok };
    });
    expect(cachedShell.ok).toBe(true);
    expect(cachedShell.markup).toContain('<div id="root"></div>');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Observe. Intervene. Compare.',
    );
    await page.getByRole('button', { name: 'Force runner-up branch' }).click();
    await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');
  } finally {
    await context.setOffline(false);
  }
});

test('cancels an interrupted model load without losing the teaching branch', async ({ page }) => {
  await page.addInitScript(() => {
    class InterruptedWorker {
      private readonly listeners = new Map<string, Set<EventListener>>();

      public addEventListener(type: string, listener: EventListener): void {
        const listeners = this.listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      public postMessage(request: { readonly context: unknown; readonly id: string }): void {
        for (const listener of this.listeners.get('message') ?? []) {
          listener(
            new MessageEvent('message', {
              data: {
                context: request.context,
                id: request.id,
                progress: { message: 'Fixture download interrupted', progress: 25 },
                type: 'progress',
              },
            }),
          );
        }
      }

      public terminate(): void {}
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: InterruptedWorker,
      writable: true,
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Force runner-up branch' }).click();
  await page.getByRole('button', { name: 'Load verified WASM' }).click();
  await expect(page.getByText('Fixture download interrupted')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel and return to demo' }).click();

  await expect(page.getByRole('button', { name: /B1.*Forced.*dark/s })).toBeVisible();
  await expect(page.getByLabel('Compared selected tokens')).toContainText('dark');
  await expect(page.getByRole('button', { name: 'Load verified WASM' })).toBeEnabled();
});
