# Static release and rollback

## Decision

The first public candidate remains a static HTTPS application with no Functions, backend, account
system or analytics. Cloudflare Pages is the prepared host because it can build the pnpm workspace,
serve immutable hashed assets and apply the checked `apps/observatory/public/_headers` rules to
static responses. This is a deployment target, not a new application dependency.

The model and tokenizer remain on their pinned upstream Hugging Face source. The release does not
mirror 327.8 MB of weights. The interface discloses the download before the user initiates it, and
the exact identities, hashes, licence and verification profile remain in the repository.

## Build contract

- Node: 24.x
- pnpm: 11.19.0
- install: `pnpm install --frozen-lockfile`
- verification: `pnpm check && pnpm test:coverage && pnpm e2e`
- build command: `pnpm build`
- output directory: `apps/observatory/dist`
- application base: `/` on a dedicated origin

`public/_headers` is copied into the production root. It provides the content security policy,
cross-origin isolation boundary, permissions policy, referrer policy, MIME protection, immutable
hashed-asset caching and a no-cache service-worker rule. The CSP admits only the pinned asset-host
families required by the optional model path; inline scripts, framing, object embedding, forms to
other origins, camera, microphone, location, payment and USB are denied. Inline styles remain
allowed because probability bars use bounded React style values.

## Release smoke

1. Confirm the deployed commit and lockfile hash match `release-evidence/manifest.json`.
2. Fetch `/`, one `/assets/*` file and `/service-worker.js`; compare the observed headers with
   `_headers`.
3. Complete the illustrative runner-up branch, reflection and JSON export without initiating a
   model download.
4. Reload once online, then revisit offline and complete the illustrative branch again.
5. On a supported desktop, opt into verified WASM, confirm the 327.8 MB disclosure and accepted
   profile, then run the live smoke separately.
6. Confirm unavailable secondary instruments still allocate zero capture bytes.

A deployed-origin result is not passed until the exact URL, browser, observed headers and candidate
commit are attached to the release manifest.

## Rollback

Retain the last accepted static deployment. If a candidate fails its smoke, restore that deployment
through the host's deployment history and verify its commit plus hero loop. Do not repair production
in place or point the service worker at mixed-version assets. A new attempt receives a new candidate
commit and evidence record.

The service-worker cache name is versioned in `public/service-worker.js`. Change it when the shell
contract changes; activation deletes older Observatory shell caches. Upstream model assets use the
browser/runtime cache and are outside the application service worker.

## Host references

- [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages serving and caching behaviour](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
