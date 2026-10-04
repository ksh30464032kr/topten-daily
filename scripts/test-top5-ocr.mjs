import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
import {extractReport} from '../services/ocr/geometry.mjs';
import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';
const source=await sharp(process.argv[2]).rotate().ensureAlpha().raw().toBuffer({resolveWithObject:true}),raster={data:source.data,width:source.info.width,height:source.info.height};
const worker=await createWorker(['eng','kor'],1,{langPath:'./public/ocr',cachePath:'../../work'});let language='eng+kor',calls=0;const start=performance.now();
try{const result=await extractReport(raster,async(r,variant)=>{let image=sharp(source.data,{raw:{width:raster.width,height:raster.height,channels:4}}).extract({left:r.left,top:r.top,width:r.width,height:r.height}).resize({width:r.width*(r.numeric?3:4)}).flatten({background:'#fff'}).normalize();if(variant==='threshold')image=image.threshold(165);if(variant==='adaptive')image=image.sharpen();return image.extend({top:20,bottom:20,left:20,right:20,background:'#fff'}).png().toBuffer();},async(img,lang)=>{calls++;const desired=lang==='eng'||lang==='number'||lang==='amount'?'eng':lang==='meta'?'kor':'eng+kor';if(desired!==language){await worker.reinitialize(desired);language=desired;}await worker.setParameters({tessedit_pageseg_mode:lang==='eng'||lang==='number'||lang==='amount'?PSM.SINGLE_LINE:PSM.SPARSE_TEXT,tessedit_char_whitelist:lang==='eng'?'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':(lang==='number'||lang==='amount')?'0123456789,':''});return (await worker.recognize(img)).data;},console.log);
await fs.writeFile('../../work/ocr-result.json',JSON.stringify(result,null,2));
assert.equal(result.national.length,5);assert.equal(result.storeRanking.length,5);assert.equal(result.date,'2026-09-30');assert.equal(result.store,'하남감일');
assert.deepEqual(result.storeRanking.map(r=>[r.code,r.quantity,r.amount]),[['MSG3PP1303',5,199500],['MSG4EC2300',3,144710],['MKG4TR3406',4,119600],['MKG3PP3301',4,103600],['MSG4EC2440',2,99800]]);
console.log('NATIONAL',result.national.map(r=>({code:r.code,agreement:r.agreement,disagreement:r.disagreement})));
console.log('PASS TOP5 same-row extraction, metadata, quantity and amount',JSON.stringify({ocrCalls:calls,elapsedMs:Math.round(performance.now()-start)}));
}finally{await worker.terminate();}
