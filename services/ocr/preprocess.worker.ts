import {detectGrid} from './geometry.mjs';
let source:OffscreenCanvas;
const make=(w:number,h:number)=>new OffscreenCanvas(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
const raster=(c:OffscreenCanvas)=>c.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,c.width,c.height);
function rotate(c:OffscreenCanvas,degrees:number){const a=degrees*Math.PI/180,out=make(Math.abs(c.width*Math.cos(a))+Math.abs(c.height*Math.sin(a)),Math.abs(c.height*Math.cos(a))+Math.abs(c.width*Math.sin(a))),ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.translate(out.width/2,out.height/2);ctx.rotate(a);ctx.drawImage(c,-c.width/2,-c.height/2);return out;}
// Mild trapezoid correction: estimate both long table borders and resample each row.
// Geometry must still pass detectGrid; unsupported perspective never fabricates rows.
function perspective(c:OffscreenCanvas){const d=raster(c),points:number[][]=[];for(let y=Math.floor(c.height*.42);y<c.height*.98;y+=3){let l=-1,r=-1;for(let x=0;x<c.width;x++)if(d.data[(y*c.width+x)*4]<100){if(l<0)l=x;r=x;}if(r-l>c.width*.7)points.push([y,l,r]);}if(points.length<30)return c;
 const fit=(k:number)=>{const n=points.length,s=points.reduce((a,p)=>a+p[0],0),t=points.reduce((a,p)=>a+p[k],0),ss=points.reduce((a,p)=>a+p[0]*p[0],0),st=points.reduce((a,p)=>a+p[0]*p[k],0),m=(n*st-s*t)/(n*ss-s*s);return [m,(t-m*s)/n];};const l=fit(1),r=fit(2);if(Math.abs(l[0])+Math.abs(r[0])<.003)return c;const out=make(c.width,c.height),ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);for(let y=0;y<c.height;y++){const x=l[0]*y+l[1],w=(r[0]-l[0])*y+r[1]-l[1];if(w>0)ctx.drawImage(c,x,y,w,1,c.width*.04,y,c.width*.92,1);}return out;}
async function crop(rect:any,variant='contrast'){
 // Remove only continuous border remnants before enlargement. Never erase a fixed
 // strip: edge-aligned product codes and right-aligned amounts touch the border.
 const cell=make(rect.width,rect.height),cellCtx=cell.getContext('2d')!;
 cellCtx.drawImage(source,rect.left,rect.top,rect.width,rect.height,0,0,rect.width,rect.height);
 const pixels=raster(cell),w=cell.width,h=cell.height;
 const dark=(x:number,y:number)=>Math.min(pixels.data[(y*w+x)*4],pixels.data[(y*w+x)*4+1],pixels.data[(y*w+x)*4+2])<145;
 const white=(x:number,y:number)=>{const i=(y*w+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;};
 if(rect.numeric||rect.codeCell){
  for(const y of [0,1,h-2,h-1]){let n=0;for(let x=0;x<w;x++)if(dark(x,y))n++;if(n>w*.85)for(let x=0;x<w;x++)white(x,y);}
  for(const x of [0,w-1]){let n=0;for(let y=0;y<h;y++)if(dark(x,y))n++;if(n>h*.9)for(let y=0;y<h;y++)white(x,y);}
 }
 cellCtx.putImageData(pixels,0,0);
 let x0=0,y0=0,x1=w-1,y1=h-1;
 if(rect.numeric||rect.codeCell){let l=w,t=h,r=-1,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(dark(x,y)){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r>=l){x0=Math.max(0,l-1);y0=Math.max(0,t-1);x1=Math.min(w-1,r+1);y1=Math.min(h-1,b+1);}}
 const cw=x1-x0+1,ch=y1-y0+1;
 // Small report glyphs are commonly only 7–10 px high. Target 56–72 px
 // rather than a fixed 3x enlargement that leaves them too small.
 const scale=Math.min(10,Math.max(4,Math.ceil((variant==='sharp'?72:56)/ch)));
 const out=make(cw*scale+64,ch*scale+64),ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.imageSmoothingEnabled=variant!=='original';ctx.imageSmoothingQuality='high';ctx.drawImage(cell,x0,y0,cw,ch,32,32,cw*scale,ch*scale);
 if(variant!=='original'){const d=raster(out),gray=new Float32Array(out.width*out.height);let min=255,max=0;for(let p=0;p<gray.length;p++){const i=p*4,v=Math.min(d.data[i],d.data[i+1],d.data[i+2]);gray[p]=v;min=Math.min(min,v);max=Math.max(max,v);}const integral=new Float64Array((out.width+1)*(out.height+1));for(let y=0;y<out.height;y++){let sum=0;for(let x=0;x<out.width;x++){sum+=gray[y*out.width+x];integral[(y+1)*(out.width+1)+x+1]=sum+integral[y*(out.width+1)+x+1];}}
 for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const p=y*out.width+x;let v=(gray[p]-min)*255/Math.max(1,max-min);if(variant==='threshold')v=v<165?0:255;if(variant==='adaptive'){const x0=Math.max(0,x-10),x1=Math.min(out.width,x+11),y0=Math.max(0,y-10),y1=Math.min(out.height,y+11),stride=out.width+1;const mean=(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));v=gray[p]<mean-12?0:255;}if(variant==='sharp'&&x>0&&y>0&&x<out.width-1&&y<out.height-1){const neighbors=(gray[p-1]+gray[p+1]+gray[p-out.width]+gray[p+out.width])/4;v=Math.max(0,Math.min(255,gray[p]*1.6-neighbors*.6));}d.data[p*4]=d.data[p*4+1]=d.data[p*4+2]=v;d.data[p*4+3]=255;}ctx.putImageData(d,0,0);}
 return out.convertToBlob({type:'image/png'});
}
self.onmessage=async(e:MessageEvent)=>{const {id,action,bitmap,rect,variant}=e.data;try{if(action==='init'){const original=make(bitmap.width,bitmap.height);original.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();let grid:any;outer:for(const rotation of [0,90,180,270]){const oriented=rotation?rotate(original,rotation):original;for(const tilt of [0,-.5,.5,-1,1,-1.5,1.5,-2,2,-3,3]){const candidate=tilt?rotate(oriented,tilt):oriented;for(const corrected of [false,true]){const image=corrected?perspective(candidate):candidate;try{grid=detectGrid(raster(image));source=image;break outer;}catch{}}}}if(!grid)throw Error('표의 행과 열을 구분하지 못했습니다. 정면에서 촬영한 선명한 리포트를 올려 주세요.');self.postMessage({id,value:grid});}else self.postMessage({id,value:await crop(rect,variant)});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}};
