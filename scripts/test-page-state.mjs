import assert from 'node:assert/strict';
import {restorePageState} from '../lib/page-state.mjs';
assert.equal(restorePageState({view:'today',date:'2026-10-14',showProducts:true},'2026-10-14').showProducts,true);
assert.equal(restorePageState({view:'closing',date:'2026-10-13',showProducts:true},'2026-10-14').view,'closing');
assert.equal(restorePageState({date:'2026-10-13',showProducts:true},'2026-10-14').showProducts,false);
assert.equal(restorePageState(null,'2026-10-14').view,'today');
assert.equal(restorePageState({view:'bogus',searched:'<invalid>'},'2026-10-14').searched,null);
console.log('Page restore tests passed');
