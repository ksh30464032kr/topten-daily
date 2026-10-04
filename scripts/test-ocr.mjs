import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
import {extractReport,detectGrid} from '../services/ocr/geometry.mjs';
import fs from 'node:fs/promises';
const path=process.argv[2];
const source=await sharp(path).rotate().ensureAlpha().raw().toBuffer({resolveWithObject:true});
const raster={data:source.data,width:source.info.width,height:source.info.height};
console.log('grid',detectGrid(raster));
const worker=await createWorker(['eng','kor'],1,{langPath:'./public/ocr',cachePath:'../../work'});
const result=await extractReport(raster,async r=>sharp(source.data,{raw:{width:raster.width,height:raster.height,channels:4}}).extract(r).resize({width:r.width*5}).flatten({background:'#fff'}).normalize().extend({top:20,bottom:20,left:20,right:20,background:'#fff'}).png().toBuffer(),async(img,lang)=>{await worker.reinitialize(lang==='eng'?'eng':lang==='meta'?'kor':['eng','kor']);await worker.setParameters({tessedit_pageseg_mode:lang==='eng'?PSM.SINGLE_LINE:PSM.SPARSE_TEXT,tessedit_char_whitelist:lang==='eng'?'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':''});return (await worker.recognize(img)).data;},console.log);
console.log(JSON.stringify(result,null,2));await fs.writeFile('../../work/ocr-result.json',JSON.stringify(result,null,2));await worker.terminate();


