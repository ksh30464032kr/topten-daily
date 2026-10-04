'use client';
import {useState} from 'react';
import ClosingChecklist from './closing-checklist';

export default function ClosingHub(){
 const [floor,setFloor]=useState<1|2|null>(null);
 if(!floor)return <section className="closing-choice"><h1>마감</h1><p className="subtitle">마감할 층을 선택하세요.</p><div><button onClick={()=>setFloor(1)}>1층 마감 <span>→</span></button><button onClick={()=>setFloor(2)}>2층 마감 <span>→</span></button></div></section>;
 return <><button className="floor-back" onClick={()=>setFloor(null)}>← 층 선택</button>{floor===1?<ClosingChecklist/>:<section className="closing"><div className="title-row"><h1>2층 마감</h1></div><div className="closing-placeholder" aria-label="2층 마감 항목 준비 중"/></section>}</>;
}
