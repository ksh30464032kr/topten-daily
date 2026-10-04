import assert from 'node:assert/strict';
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist/client');
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const prefix = process.env.GITHUB_ACTIONS === 'true' && repo && !repo.endsWith('.github.io') ? `/${repo}` : '';
// Vinext includes a path-based assetPrefix in its on-disk asset directory.
// Pages already mounts the artifact at /<repo>/, so expose _next at its root.
if (prefix) {
  const nestedAssets = path.join(root, repo, '_next');
  assert(existsSync(nestedAssets), `Expected Vinext assets at ${nestedAssets}`);
  cpSync(nestedAssets, path.join(root, '_next'), { recursive: true });
}
const manifest = JSON.parse(readFileSync('dist/server/vinext-prerender.json', 'utf8'));
assert(manifest.routes.some(route => route.route === '/' && route.status === 'rendered'), 'Home route was not prerendered; refusing to publish a 404.');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('TOPTEN') && html.includes('<body'), 'index.html must contain the app.');
let assets = 0;
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#|\/\/)/.test(url)) continue;
  const pathname = new URL(url, `https://pages.invalid${prefix}/`).pathname;
  assert(pathname.startsWith(`${prefix}/`), `Asset escapes the Pages base: ${url}`);
  const relative = decodeURIComponent(pathname.slice(prefix.length + 1));
  assert(existsSync(path.join(root, relative)), `Missing asset: ${url}`);
  assets++;
}
assert(assets > 0, 'No static assets found.');
const scripts = readdirSync(root, { recursive: true }).filter(file => file.endsWith('.js'));
const api = process.env.NEXT_PUBLIC_API_BASE;
assert(api && new URL(api).protocol === 'https:', 'A production HTTPS API URL is required.');
assert(scripts.some(file => readFileSync(path.join(root, file), 'utf8').includes(api.replace(/\/$/, ''))), 'Cloud Run URL is missing from the client bundle.');
writeFileSync(path.join(root, '.nojekyll'), '');
console.log(`Verified rendered home, ${assets} asset references, and Cloud Run API URL. Publish ${root}`);
