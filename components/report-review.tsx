'use client';
import type {Report,Row} from '../lib/report';
import type {Product} from '../services/topten';

export default function ReportReview({
 draft,onChange
}:{
 draft:Report;
 products:Record<string,Product>;
 onChange:(r:Report)=>void;
 lookup:(code:string,force?:boolean)=>Promise<Product>;
 onError:(s:string)=>void;
}){
 function patch(i:number,change:Partial<Row>){
  onChange({...draft,storeRanking:draft.storeRanking.map((r,n)=>n===i?{...r,...change}:r)});
 }
 return <div style={{display:'grid',gap:8}}>
  {draft.storeRanking.slice(0,5).map((row,i)=>
   <div key={i} style={{display:'grid',gridTemplateColumns:'70px 1fr 120px',gap:8,alignItems:'center'}}>
    <strong>{row.rank||i+1}위</strong>
    <input value={row.code||''} onChange={e=>patch(i,{code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')})}/>
    <input inputMode="numeric" value={row.quantity??''} onChange={e=>/^\d*$/.test(e.target.value)&&patch(i,{quantity:e.target.value===''?null:Number(e.target.value)})}/>
   </div>
  )}
 </div>;
}
