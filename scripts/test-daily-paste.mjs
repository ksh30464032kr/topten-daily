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
const userInput=`날짜: 2026-10-09
목표금액: 확인 필요
TOP5:
1. MKG4PP3303, 3
2. MSG4JP2403, 2
3. MKG3PP3301, 3
4. MSG4PT1411, 3
5. MSG4TC2404, 3`;
assert.throws(()=>parseDailyPaste(userInput,'2026-10-10'));
const checked=parseDailyPaste(userInput,'2026-10-10',true);
assert.equal(checked.date,'2026-10-09');
assert.deepEqual(checked.rows.map(r=>r.quantity),['3','2','3','3','3']);
assert.equal(checked.target,'');
assert.throws(()=>parseDailyPaste(userInput.replace('2026-10-09','2026-02-30'),'2026-10-10',true));
