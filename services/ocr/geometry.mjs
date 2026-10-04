import {consensus,inspectCode} from './validation.mjs';
// Detect a repeated table grid from pixels, independent of report date, codes or dimensions.
function groups(values) {
  const out=[]; for(const v of values) { const last=out.at(-1); if(last && v-last.at(-1)<=2) last.push(v); else out.push([v]); }
  return out.map(g=>Math.round(g.reduce((a,b)=>a+b,0)/g.length));
}
export function detectGrid({data,width:w,height:h}) {
  const dark=(x,y)=>data[(y*w+x)*4]<145;
  const horizontal=[];
  for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++)if(dark(x,y))count++;if(count>w*.55)horizontal.push(y);}
  const ys=groups(horizontal); let best=[];
  for(let i=0;i<ys.length-10;i++){
    const run=[ys[i]], step=ys[i+1]-ys[i];if(step<8)continue;
    for(let j=i+1;j<ys.length;j++){if(Math.abs(ys[j]-run.at(-1)-step)>Math.max(3,step*.13))break;run.push(ys[j]);}
    if(run.length>best.length)best=run;
  }
  if(best.length<12)throw Error('판매 BEST 표를 찾을 수 없습니다. 표 전체가 선명하게 보이는 이미지를 올려 주세요.');
  let top=best[0];const bottom=best.at(-1),step=(bottom-top)/(best.length-1), vertical=[];
  for(let x=0;x<w;x++){let count=0;for(let y=top+3;y<bottom-2;y++)if(dark(x,y))count++;if(count>(bottom-top)*.8)vertical.push(x);}
  const xs=groups(vertical);if(xs.length<7)throw Error('품번 열을 구분할 수 없습니다. 더 선명한 리포트를 올려 주세요.');
  const mid=Math.round(top+step*.5);
  if(xs.filter(x=>dark(x,mid)).length<xs.length*.75){best=best.slice(1);top=best[0];}
  // Merged column headers span the two ranking blocks. The divider continues through them.
  const extended=xs.filter(x=>{let count=0;const a=Math.max(0,Math.round(top-step*.7)),b=Math.round(top-3);for(let y=a;y<b;y++)if(dark(x,y))count++;return count>(b-a)*.7;});
  let split=extended.find(x=>x>xs[1]+step*2 && x<xs.at(-1)-w*.2);
  if(split===undefined)throw Error('전 매장과 우리 매장의 구분선을 찾을 수 없습니다.');
  const splitIndex=xs.indexOf(split);
  let headerLine=0;for(let y=Math.round(h*.04);y<top-step*4;y++){let count=0;for(let x=0;x<w;x++)if(dark(x,y))count++;if(count>w*.45){headerLine=y;break;}}
  return {ys:best,xs,top,bottom,step,rank:[xs[0],xs[1]],quantity:[xs[splitIndex+1],xs[splitIndex+2]],amount:[xs[splitIndex+2],xs[splitIndex+3]],columns:[[xs[1],xs[2]],[xs[splitIndex],xs[splitIndex+1]]],metadata:{left:Math.round(w*.35),top:Math.max(0,Math.round(headerLine-step*2)),width:Math.floor(w*.65),height:Math.max(20,Math.round(step*2)-2)},heading:{left:xs[0],top:Math.max(0,Math.round(top-step*3)),width:xs.at(-1)-xs[0],height:Math.round(step*2)}};
}
export function cleanCode(text){return text.toUpperCase().replace(/[^A-Z0-9]/g,'');}
export function validCode(code){return /^[A-Z0-9]{8,15}$/.test(code)&&/[A-Z]/.test(code)&&/[0-9]/.test(code);}
export function parseMetadata(text){
  const m=text.match(/(20\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  const date=m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
  const tail=m?text.slice(text.indexOf(m[0])+m[0].length):'';
  const store=tail.replace(/[A-Za-z0-9_]+/g,'').replace(/[^가-힣\s]/g,'').trim().replace(/\s+/g,'');
  return {date,store};
}
export async function recognizeCell(rect,crop,recognize,extra=false){
 const readings=[];for(const variant of extra?['sharp','original','adaptive']:['original','contrast','sharp']){
  const result=await recognize(await crop({...rect,codeCell:true},variant),variant==='original'?'engRaw':'eng');readings.push({code:cleanCode(result.text),confidence:result.confidence||0,variant});
  const vote=consensus(readings),v=inspectCode(vote.code);
  if(readings.length>=2&&vote.agreement>=2&&vote.confidence>=70&&!vote.disagreement&&v.format&&v.known)break;
 }
 return {...consensus(readings),rect,valid:validCode(consensus(readings).code)};
}
export async function recognizeNumberCell(rect,crop,recognize){const readings=[];for(const variant of ['contrast','original','threshold']){const r=await recognize(await crop({...rect,numeric:true},variant),rect.width>rect.height*3.1?'amount':'number'),text=r.text.trim().replace(/[,\s]/g,'');readings.push({code:/^\d+$/.test(text)?text:'',confidence:r.confidence||0,variant});const vote=consensus(readings);if(vote.code&&vote.agreement>=2&&vote.confidence>=60)return {value:Number(vote.code),confirmed:true,rect,readings};}return {value:null,confirmed:false,rect,readings};}
export async function extractReport(raster,crop,recognize,onProgress=(message)=>{}){
  const grid=raster.grid||detectGrid(raster);onProgress('TOP5 셀 영역 확인');
  const meta=await recognize(await crop(grid.metadata),'meta');
  const lists=[];const ranks=[];
  const box=(column,i)=>({left:column[0]+1,top:grid.ys[i]+1,width:column[1]-column[0]-1,height:grid.ys[i+1]-grid.ys[i]-1,numeric:true});
  const number=(column,i)=>recognizeNumberCell(box(column,i),crop,recognize);
  // Rank is the physical row under the table header, not a fragile isolated digit OCR.
  for(let side=1;side<2;side++){
    const list=[]; const [x1,x2]=grid.columns[side];
    // The same physical Y bounds bind rank, code, quantity and amount together.
    for(let i=1;i<=5;i++){
      const y1=grid.ys[i],y2=grid.ys[i+1];
      const result=await recognizeCell({left:x1+1,top:y1+1,width:x2-x1-1,height:y2-y1-1},crop,recognize);
      const numeric=side===1?{quantity:await number(grid.quantity,i),amount:await number(grid.amount,i)}:{};
      list.push({...result,rank:i,rankConfirmed:true,quantity:numeric.quantity?.value,amount:numeric.amount?.value,numericConfirmed:!!(numeric.quantity?.confirmed&&numeric.amount?.confirmed),quantityReadings:numeric.quantity?.readings,amountReadings:numeric.amount?.readings,quantityRect:numeric.quantity?.rect,amountRect:numeric.amount?.rect});
      onProgress(`${side===0?'전국':'우리 매장'} ${i}/5위 품번·행 데이터 인식`);
    }
    lists.push(list);
  }
  return {...parseMetadata(meta.text),national:[],storeRanking:lists[0],metadataText:meta.text};
}


