import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../services/topten/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
let calls=0;
const realFetch=globalThis.fetch;
globalThis.fetch=async()=>{calls++;return Response.json({documents:[{GOD_NO:'MSG3PP1303DCH',BRND_ID:'MSBR',GOD_NM:'Test product',LAST_SALE_PRC:39900,IMG_URL:'/goods/test.jpg'}]});};
for(const mode of ['read throws','write throws','getter throws']){
 Object.defineProperty(globalThis,'caches',{configurable:true,value:mode==='getter throws'?Object.defineProperty({},'default',{get(){throw Error('unavailable');}}):{default:{match:async()=>{if(mode==='read throws')throw Error('unavailable');return undefined;},put:async()=>{throw Error('write unavailable');}}}});
 const {getProduct}=await import('data:text/javascript;base64,'+Buffer.from(compiled+'\n// '+mode).toString('base64'));
 const before=calls;
 const results=await Promise.all([getProduct('MSG3PP1303','https://example.com'),getProduct('MSG3PP1303','https://example.com')]);
 assert.equal(results[0].status,'found',mode);assert.equal(results[1].price,39900);assert.equal(calls-before,1,'deduplicates requests');
 await getProduct('MSG3PP1303','https://example.com');assert.equal(calls-before,1,'memory cache');
 console.log('PASS',mode,'+ concurrent and repeat request cache');
}
const {getProduct}=await import('data:text/javascript;base64,'+Buffer.from(compiled+'\n// failure cases').toString('base64'));
globalThis.fetch=async()=>{calls++;return Response.json({documents:[]});};
let before=calls;assert.equal((await getProduct('MSG4WG1400')).status,'missing');assert.equal(calls-before,1,'missing code does not fan out into candidate queries');
globalThis.fetch=async()=>{calls++;return Response.json({documents:[{GOD_NO:'MSG4WC1400BK',BRND_ID:'MSBR',GOD_NM:'셔츠',CVR_PRC:39900,LAST_SALE_PRC:19900,IMG_URL:'/goods/image.jpg'}]});};
const found=await getProduct('MSG4WC1400');assert.equal(found.normalPrice,39900);assert.equal(found.price,19900);
before=calls;await getProduct('MSG4WC1400');assert.equal(calls,before);await getProduct('MSG4WC1400',undefined,true);assert.equal(calls,before+1,'manual refresh bypasses cache');
assert.equal((await getProduct('MSG4WC1401')).status,'missing','another real code is not an exact match');
globalThis.fetch=async()=>{throw Error('network offline');};assert.equal((await getProduct('MKG4TR3406')).status,'error');assert.equal((await getProduct('MSG4WC1400',undefined,true)).stale,true,'stale fallback must be marked');
console.log('PASS no search fanout, both prices, force refresh, exact-code matching, network isolation and stale flag');
globalThis.fetch=realFetch;
delete globalThis.caches;
