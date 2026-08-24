const CACHE_NAME = 'observatory-shell-v3';
const APP_SHELL_URL = new URL('./', self.registration.scope).href;

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(APP_SHELL_URL, { cache: 'reload' });
  if (!response.ok) throw new Error(`Application shell returned ${response.status}.`);
  const markup = await response.clone().text();
  await cache.put(APP_SHELL_URL, response);

  const assetPaths = [...markup.matchAll(/(?:href|src)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path && new URL(path, self.location.href).origin === self.location.origin);
  await Promise.all(assetPaths.map((path) => cache.add(path)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheApplicationShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (!response.ok) return (await caches.match(APP_SHELL_URL)) ?? response;
          await (await caches.open(CACHE_NAME)).put(APP_SHELL_URL, response.clone());
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL_URL)) ?? Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then(async (response) => {
          if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
          return response;
        }),
    ),
  );
});
