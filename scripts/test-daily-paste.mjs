import assert from 'node:assert/strict';
import {parseDailyPaste} from '../lib/daily-paste.mjs';
const input=`날짜: 2026-10-09
목표금액: 8,400,000원
TOP5:
1. MSG4JP2402, 12
2. MSG4JP2403, 10
3. MSG4PT1482, 확인 필요
4. MSG4ER2410, 7
5. 확인 필요, 5`;
const result=parseDailyPaste(input,'2026-10-09');
assert.equal(result.target,'840');
assert.equal(result.rows[2].quantity,'');
assert.equal(result.rows[4].code,'');
assert.equal(result.rows[0].code,'MSG4JP2402');
assert.throws(()=>parseDailyPaste(input,'2026-10-10'));
assert.throws(()=>parseDailyPaste(input.replace('MSG4JP2403','MSG4JP2402'),'2026-10-09'));
assert.throws(()=>parseDailyPaste(input.replace('2.','3.'),'2026-10-09'));
assert.throws(()=>parseDailyPaste(input.replace('8,400,000원','840만원'),'2026-10-09'));
assert.equal(parseDailyPaste('```text\n'+input+'\n```','2026-10-09').rows.length,5);
console.log('GPT paste tests passed');
