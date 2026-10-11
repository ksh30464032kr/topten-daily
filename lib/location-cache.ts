import seed from './location-seed.json';
import {API_BASE} from './daily';
export type LocationItem={id:string;name:string;aliases:string;floor:string;group:string;location:string};
export type LocationCatalog={items:LocationItem[];revision:string;updatedAt?:string};
const KEY='topten.locations.v1';
let cached:LocationCatalog|null=null,last=0,pending:Promise<LocationCatalog>|null=null;
export function cachedLocations():LocationCatalog{
 if(cached)return cached;
 try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(value?.items)&&typeof value.revision==='string')return cached=value;}catch{}
 return seed;
}
export function storeLocations(value:LocationCatalog){cached=value;last=Date.now();try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}return value;}
export function readLocations(force=false):Promise<LocationCatalog>{
 if(!force&&cached&&Date.now()-last<60000)return Promise.resolve(cached);
 if(pending)return pending;
 pending=fetch(API_BASE+'/api/locations',{cache:'no-store',signal:AbortSignal.timeout(30000)}).then(async r=>{if(!r.ok)throw Error('매장 위치를 갱신하지 못했습니다.');return storeLocations(await r.json() as LocationCatalog);}).finally(()=>{pending=null;});
 return pending;
}
