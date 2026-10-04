export type Product={code:string;name?:string;price?:number;normalPrice?:number;image?:string;url:string;status:'found'|'missing'|'error';checkedAt:string;stale?:boolean;suggestions?:string[]};
const inflight=new Map<string,Promise<Product>>();
const memory=new Map<string,{product:Product;expires:number}>();
export const searchUrl=(code:string)=>`https://display-topten10.goodwearmall.com/search?keyword=${encodeURIComponent(code)}`;
export function candidates(code:string){
  const swaps:Record<string,string>={O:'0','0':'O',I:'1','1':'I',S:'5','5':'S',B:'8','8':'B',G:'6','6':'G'};
  const out=new Set<string>();
  // Segmentation can duplicate a glyph. Validate deletion candidates against real products.
  if(code.length===11)for(let i=0;i<code.length;i++)out.add(code.slice(0,i)+code.slice(i+1));
  // Structured candidate is only offered if the official API confirms it; never silently replace OCR.
  if(code.length===10){let c=code.split('');for(const i of [3,6,7,8,9])if(/[OISBG]/.test(c[i]))c[i]=swaps[c[i]];for(const i of [0,1,2,4,5])if(/[01586]/.test(c[i]))c[i]=swaps[c[i]];out.add(c.join(''));}
  for(let i=0;i<code.length;i++)if(swaps[code[i]])out.add(code.slice(0,i)+swaps[code[i]]+code.slice(i+1));
  out.delete(code);return [...out].slice(0,16);
}
async function query(code:string):Promise<Product>{
  const fallback:Product={code,status:'missing',url:searchUrl(code),checkedAt:new Date().toISOString()};
  try{
    const res=await fetch(`https://display-topten10.goodwearmall.com/api/search/keyword?keyword=${encodeURIComponent(code)}&pageNo=1`,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('mall unavailable');
    const body:any=await res.json();if(!Array.isArray(body.documents))throw Error('schema changed');
    const d=body.documents.find((p:any)=>typeof p.GOD_NO==='string' && (p.GOD_NO===code || (p.GOD_NO.startsWith(code)&&/^[A-Z0-9]{2,3}$/.test(p.GOD_NO.slice(code.length)))) && ['MSBR','MKBR'].includes(p.BRND_ID));
    if(!d)return fallback;
    const image=new URL(d.IMG_URL,'https://img.goodwearmall.com');
    return {...fallback,status:'found',name:String(d.GOD_NM),normalPrice:d.CVR_PRC!=null&&Number.isFinite(Number(d.CVR_PRC))?Number(d.CVR_PRC):undefined,price:d.LAST_SALE_PRC!=null&&Number.isFinite(Number(d.LAST_SALE_PRC))?Number(d.LAST_SALE_PRC):undefined,image:image.protocol==='https:'&&image.hostname.endsWith('.goodwearmall.com')?image.href:undefined,url:`https://topten10.goodwearmall.com/product/${encodeURIComponent(d.GOD_NO)}/detail`};
  }catch{return {...fallback,status:'error'};}
}
export async function getProduct(code:string,origin='https://topten-daily-cache.invalid',force=false):Promise<Product>{
  const now=Date.now(),cached=memory.get(code);if(!force&&cached&&cached.expires>now)return cached.product;
  if(inflight.has(code))return inflight.get(code)!;
  const task=(async()=>{
    // Cloudflare cache survives isolate eviction; local development falls back to memory.
    // Some hosted dispatch runtimes expose Cache API but reject operations.
    // Cache is optional: a failed read/write must never break product lookup.
    let cache:Cache|undefined;
    const key=new Request(`${origin}/api/products/${code}?cache=v4`);
    try{cache=(globalThis as any).caches?.default;const hit=cache&&!force?await cache.match(key):null;if(hit){const p=await hit.json() as Product;if(p.status==='found'&&Date.now()-Date.parse(p.checkedAt)<86400000){memory.set(code,{product:p,expires:Date.parse(p.checkedAt)+86400000});return p;}}}catch{cache=undefined;}
    let p=await query(code);
    if(p.status==='error'&&cached?.product.status==='found')return {...cached.product,stale:true};
    const ttl=p.status==='found'?86400:p.status==='missing'?1800:30;
    if(memory.size>500)memory.delete(memory.keys().next().value!);
    memory.set(code,{product:p,expires:now+ttl*1000});
    if(cache&&p.status!=='error')try{await cache.put(key,new Response(JSON.stringify(p),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${ttl}`}}));}catch{/* Upstream result is still usable without cache. */}
    return p;
  })();inflight.set(code,task);try{return await task;}finally{inflight.delete(code);}
}

