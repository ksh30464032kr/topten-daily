import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('services/ocr/browser.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
let revision = 0;
const load = () => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${revision++}`);
const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  let finish;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const client = await load();
  const first = client.warmup();
  const second = client.warmup();
  assert.equal(calls, 1, 'Page entry and upload must share one warmup request');
  finish(Response.json({ ok: true }));
  await Promise.all([first, second]);
  await client.warmup();
  assert.equal(calls, 1, 'A recently ready server needs no extra health request');

  const retryClient = await load();
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(retryClient.warmup(), /서버를 준비하지 못했습니다/);
  globalThis.fetch = async () => Response.json({ ok: true });
  await retryClient.warmup();

  const badClient = await load();
  globalThis.fetch = async () => Response.json({ ok: false });
  await assert.rejects(badClient.warmup(), /서버를 준비하지 못했습니다/);
  console.log('OCR connection tests passed: deduplication, ready cache, failure recovery, readiness validation.');
} finally {
  globalThis.fetch = originalFetch;
}
