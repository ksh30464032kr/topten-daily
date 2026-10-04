'use client';
import {useEffect,useRef} from 'react';
import type {Row} from '../lib/report';
import type {Product} from '../services/topten';
import {productStorage} from '../lib/product-storage';
import {briefing} from '../lib/briefing.mjs';
import {validation} from '../services/ocr/validation.mjs';
export default function BriefingDialog({rows,products,date,scope,onClose,onCopy}:{rows:Row[];products:Record<string,Product>;date:string;scope:string;onClose:()=>void;onCopy:(text:string)=>void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 const scripts=rows.slice(0,5).sort((a,b)=>a.rank-b.rank).map(row=>{const notes=productStorage.read(row.code),p=products[row.code];return {row,text:briefing(row,{...(validation(row,p).verified?p:{}),...notes.manual},notes,date,scope)};});
 return <dialog ref={ref} className="briefing-dialog" onCancel={onClose} onClick={e=>e.target===e.currentTarget&&onClose()}><div className="briefing-heading"><div><small>{date} · {scope}</small><h2>전체 브리핑</h2></div><button onClick={onClose} aria-label="브리핑 닫기">닫기</button></div><button className="primary" onClick={()=>onCopy(scripts.map(s=>`${s.row.rank}위 · ${s.row.code}\n${s.text}`).join('\n\n'))}>전체 복사</button>{scripts.map(({row,text})=><section key={row.rank}><strong>{row.rank}위 · {row.code}</strong><p>{text}</p><button onClick={()=>onCopy(text)}>복사</button></section>)}<p className="muted">확인되지 않은 상품명·가격은 대본에서 제외합니다.</p></dialog>;
}
