import sharp from 'sharp';
import {initialProofCrop} from '../lib/proof-crop.mjs';
const names=process.argv.slice(2);
if(names.length!==3)throw new Error('Pass three local screenshot paths');
const tiles=[];
for (const [i,name] of names.entries()) {
 const path=name;
 const {width,height}=await sharp(path).metadata();
 const crop=initialProofCrop(width,height);
 const left=Math.round(width*crop.left/100),top=Math.round(height*crop.top/100);
 const image=await sharp(path).extract({left,top,width:Math.round(width*(crop.right-crop.left)/100),height:Math.round(height*(crop.bottom-crop.top)/100)}).resize(360,450,{fit:'contain',background:'white'}).png().toBuffer();
 tiles.push({input:image,left:i*380,top:0});
 console.log(i+1,width,height,crop);
}
await sharp({create:{width:1140,height:450,channels:3,background:'white'}}).composite(tiles).png().toFile('outputs/proof-three-crops.png');

