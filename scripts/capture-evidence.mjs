import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { chromium } from '@playwright/test';

const baseURL = process.env.OBSERVATORY_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const outputDirectory = resolve('docs/evidence');

await mkdir(outputDirectory, { recursive: true });

const server = process.env.OBSERVATORY_BASE_URL
  ? null
  : spawn(resolve('apps/observatory/node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1'], {
      cwd: resolve('apps/observatory'),
      stdio: 'inherit',
    });

if (server) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) break;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    if (attempt === 39) throw new Error(`Preview server did not become ready at ${baseURL}.`);
  }
}

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
});

try {
  const desktop = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
  await desktop.goto(baseURL);
  await desktop.screenshot({
    animations: 'disabled',
    path: resolve(outputDirectory, 'session-01-welcome.png'),
  });
  await desktop.locator('.top-rail').evaluate((element) => {
    element.style.position = 'absolute';
  });
  await desktop.getByRole('button', { name: 'Force runner-up branch' }).click();
  await desktop.locator('.instrument-workbench').screenshot({
    animations: 'disabled',
    path: resolve(outputDirectory, 'session-01-workbench.png'),
  });
  await desktop.locator('.branch-chamber').screenshot({
    animations: 'disabled',
    path: resolve(outputDirectory, 'session-01-branch-chamber.png'),
  });

  const mobile = await browser.newPage({ viewport: { height: 844, width: 390 } });
  await mobile.goto(baseURL);
  await mobile.getByRole('heading', { name: 'Probability spectrometer' }).scrollIntoViewIfNeeded();
  await mobile.screenshot({
    animations: 'disabled',
    path: resolve(outputDirectory, 'session-01-mobile.png'),
  });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}

console.log(`Captured visual evidence in ${outputDirectory}.`);
