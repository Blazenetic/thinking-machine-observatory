# Privacy

The Thinking Machine Observatory is designed as a local-first static browser application.

- **No account:** the released application has no sign-in or user profile.
- **No analytics:** the application does not load an analytics, advertising or behavioural tracking
  service.
- **No prompt telemetry:** prompt text, selected tokens, traces and notebook reflections are not sent
  to an Observatory backend.
- **Local processing:** optional inference runs in the browser worker. Loading it fetches pinned model
  and tokenizer assets from the named upstream host unless those assets are already cached.
- **Local persistence:** a trace enters IndexedDB only after the user chooses to save it. Exporting a
  trace creates a local download chosen by the user.
- **Offline shell:** the production service worker caches the same-origin application shell. It does
  not cache cross-origin model assets itself and does not transmit a usage log.

Browser, operating-system, network and upstream asset hosts may retain data under their own policies.
Anyone deploying a modified build is responsible for updating this notice if they add telemetry,
accounts, a backend, a model mirror or other data flow.
