import assert from 'node:assert/strict';
import {suggestNames} from '../lib/location-suggestions.mjs';
const items=[{name:'남성 그래픽 후드',aliases:'그림 후드, 프린팅 후드'},{name:'여성 그래픽 티셔츠',aliases:'그림 티'},{name:'남성 그래픽 후드',aliases:'후드티'}];
assert.equal(suggestNames(items,'그래픽').length,2);
assert.equal(suggestNames(items,'그림 후드')[0].name,'남성 그래픽 후드');
assert.equal(suggestNames(items,'그래픽후드')[0].name,'남성 그래픽 후드');
assert.equal(suggestNames(items,'').length,0);
assert.equal(suggestNames(items,'바지').length,0);
console.log('Related name search tests passed');
