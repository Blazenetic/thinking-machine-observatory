import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const headers = readFileSync(resolve(root, 'apps/observatory/public/_headers'), 'utf8');
const licence = readFileSync(resolve(root, 'LICENSE'), 'utf8');
const notices = readFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
const privacy = readFileSync(resolve(root, 'PRIVACY.md'), 'utf8');
const deployment = readFileSync(resolve(root, 'docs/deployment/static-release.md'), 'utf8');
const wrangler = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');

const requiredHeaderFragments = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  'https://huggingface.co',
  "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy: same-origin',
  'Permissions-Policy:',
  'Referrer-Policy: no-referrer',
  'X-Content-Type-Options: nosniff',
  'Cache-Control: public, max-age=31536000, immutable',
  'Cache-Control: no-cache, no-store, must-revalidate',
];
for (const fragment of requiredHeaderFragments) {
  if (!headers.includes(fragment)) throw new Error(`Static headers omit ${fragment}.`);
}
for (const line of headers.split('\n')) {
  if (line.length > 2_000) throw new Error('A static header line exceeds the host limit.');
}

if (!licence.includes('All rights reserved'))
  throw new Error('Project rights notice is incomplete.');
for (const dependency of ['React', 'Transformers.js', 'ONNX Runtime Web', 'DistilGPT2']) {
  if (!notices.includes(dependency)) throw new Error(`Third-party notices omit ${dependency}.`);
}
for (const statement of ['No account', 'No analytics', 'No prompt telemetry']) {
  if (!privacy.includes(statement)) throw new Error(`Privacy notice omits ${statement}.`);
}
if (!deployment.includes('Rollback')) throw new Error('Static deployment runbook needs rollback.');
if (!deployment.includes('npx wrangler deploy')) {
  throw new Error('Static deployment runbook needs the workspace-root Wrangler deploy command.');
}
if (!deployment.includes('thinking-machine-observatory')) {
  throw new Error('Static deployment runbook needs the Cloudflare project name.');
}

if (!wrangler.includes('name = "thinking-machine-observatory"')) {
  throw new Error('Wrangler config must name the Cloudflare project.');
}
if (!wrangler.includes('directory = "./apps/observatory/dist"')) {
  throw new Error('Wrangler config must target the observatory production bundle.');
}
if (/(^|\\n)\\s*main\\s*=/.test(wrangler)) {
  throw new Error('Wrangler config must not introduce a Worker script.');
}
if (wrangler.includes('pages_build_output_dir')) {
  throw new Error('Wrangler config must stay on static assets, not a Pages Functions project.');
}

console.log('Static release policy, rights, third-party notices and privacy wording are complete.');
