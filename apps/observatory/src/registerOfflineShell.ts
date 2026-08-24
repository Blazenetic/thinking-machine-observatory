interface BuildEnvironment {
  readonly BASE_URL: string;
  readonly PROD: boolean;
}

export function registerOfflineShell(): void {
  const environment = import.meta.env as BuildEnvironment;
  if (!environment.PROD || !('serviceWorker' in navigator)) return;
  globalThis.addEventListener(
    'load',
    () => {
      const serviceWorkerUrl = `${environment.BASE_URL}service-worker.js`;
      void navigator.serviceWorker.register(serviceWorkerUrl).catch((error: unknown) => {
        console.warn(
          'Offline shell registration failed; the current session remains usable.',
          error,
        );
      });
    },
    { once: true },
  );
}
