'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,ClipboardCheck} from 'lucide-react';
import {achievement,closingMessage} from '../lib/closing';

const KEY='topten.closing.v1';
type Day={checks:Record<string,boolean>;transfer:string;sales:string;target:string;status:string;issue:string;includeRate:boolean};
const blank=():Day=>({checks:{},transfer:'',sales:'',target:'',status:'',issue:'',includeRate:false});
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const steps=[
 {title:'마감 준비',hint:'21:40 · 안내와 음악을 먼저 확인해요.',items:[['announcement','바탕화면 메모장 마감 멘트 확인·안내'],['music','1번 포스 노래 종료'],['store-photo-1','매장 마감 사진 1 촬영'],['store-photo-2','매장 마감 사진 2 촬영']]},
 {title:'POS 매출 확인',hint:'F-POS(우주 모양 아이콘) → 판매 → 판매정산현황',items:[['pos','F-POS 판매정산현황 열기'],['pos-date','조회 날짜를 오늘 날짜로 맞추고 조회']]},
 {title:'결제 내역 대조',hint:'머니온 매출관리 서비스 → 매출상세조회 → 검색',items:[['moneyon','머니온 로그인 후 매출상세조회·검색'],['banks','은행별 금액 대조'],['easy','이지샵·네이버페이·카카오페이 확인'],['transactions','매출관리 → 거래내역조회 → 조회·대조']]},
 {title:'현금 정산',hint:'컴퓨터의 기존 엑셀 파일에서 현금을 계산하세요.',items:[['cash-count','엑셀로 현금 계산 후 기본 시재 450,000원 차감 확인'],['cash-bag','기본 시재를 제외한 정산 현금 담기'],['cash-paper','용지 확인 후 볼펜으로 금액 기록']]},
 {title:'증빙 촬영',hint:'사진을 찍은 뒤 체크하세요. 사진 파일은 올리지 않아요.',items:[['evidence-photo','펀칭 종이 + 현금 시재 + 체크리스트·일일리스트 촬영'],['board','오늘 날짜 보드마카 내용 촬영']]},
 {title:'출입문 잠금',hint:'마감 보고 전에 엘리베이터 2층 OFF와 후문 잠금을 확인하세요.',items:[['elevator-lock','엘리베이터 2층 OFF 하기'],['back-door-lock','후문 잠그기'],['pos-photo','포스쪽 사진 찍기'],['front-photo','정문 사진 찍기']]},
 {title:'마감 보고',hint:'금액과 이상 여부를 확인한 뒤 보고 문구를 복사해요.',items:[['review','증빙 사진과 보고 금액 최종 확인'],['sent','마감 보고 전송 완료']]},
];
const allIds=steps.flatMap(s=>s.items.map(i=>i[0]));
export default function ClosingChecklist(){
 const [date,setDate]=useState(''),[days,setDays]=useState<Record<string,Day>>({}),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState(''),[storageError,setStorageError]=useState('');
 const [resetting,setResetting]=useState(false);
 const reportText=useRef<HTMLTextAreaElement>(null);
 const itemRefs=useRef<Record<string,HTMLLabelElement|null>>({}),highlightTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const [highlight,setHighlight]=useState('');
 useEffect(()=>()=>{if(highlightTimer.current)clearTimeout(highlightTimer.current);},[]);
 useEffect(()=>{setDate(today());try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))setDays(saved);}catch{setStorageError('저장된 마감 기록을 읽지 못했습니다. 브라우저 저장 권한을 확인해 주세요.');}setLoaded(true);},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice]);
 const day={...blank(),...days[date]};
 function update(patch:Partial<Day>){if(!loaded||!date)return;const next={...days,[date]:{...day,...patch}};setDays(next);try{localStorage.setItem(KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('기기에 저장하지 못했습니다. 이 화면을 닫으면 입력 내용이 사라질 수 있어요.');}}
 const rate=achievement(day.sales,day.target),completed=allIds.filter(id=>day.checks[id]).length;
 const firstUnchecked=allIds.find(id=>!day.checks[id]);
 function jumpToFirst(){if(!firstUnchecked)return;const target=itemRefs.current[firstUnchecked];if(!target)return;const header=document.querySelector('header');const offset=(header?.getBoundingClientRect().height||0)+16;window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target.focus({preventScroll:true});setHighlight(firstUnchecked);if(highlightTimer.current)clearTimeout(highlightTimer.current);highlightTimer.current=setTimeout(()=>setHighlight(''),1800);}
 function resetDay(){setResetting(false);update(blank());setWanInputs(prev=>Object.fromEntries(Object.entries(prev).filter(([key])=>!key.startsWith(date))));setNotice('선택한 날짜의 마감 기록을 초기화했어요.');}
 const [wanInputs,setWanInputs]=useState<Record<string,string>>({});
 function wanValue(field:'sales'|'target'){return wanInputs[date+field]??(day[field]===''?'':String(Number(day[field])/10000));}
 function updateWan(field:'sales'|'target',value:string){if(!/^\d{0,6}(\.\d{0,4})?$/.test(value))return;setWanInputs(prev=>({...prev,[date+field]:value}));update({[field]:value===''||value==='.'?'':String(Math.round(Number(value)*10000))});}
 const message=closingMessage(day.transfer===''?null:Number(day.transfer),day.status,day.issue,rate,day.includeRate);
 function number(value:string,apply:(v:string)=>void,max=10){if(new RegExp(`^\\d{0,${max}}$`).test(value))apply(value);}
 async function copy(){try{await navigator.clipboard.writeText(message);setNotice('마감 보고를 복사했어요. 카톡에 붙여넣어 주세요.');}catch{reportText.current?.focus();reportText.current?.select();setNotice('복사가 제한되어 문구를 선택했어요. 길게 눌러 복사해 주세요.');}}
 return <section className="closing">
  <div className="title-row"><div><h1>마감 체크리스트</h1><p className="subtitle">21:40부터, 순서대로 하나씩 확인하세요.</p></div><button className="closing-reset" disabled={!loaded} onClick={()=>setResetting(true)}>초기화</button></div>
  {resetting&&<div className="closing-warning" role="alertdialog" aria-label="마감 기록 초기화 확인"><p>{date}의 체크와 입력값을 모두 초기화할까요? 다른 날짜 기록은 유지됩니다.</p><button className="primary" onClick={resetDay}>초기화하기</button><button className="closing-reset" onClick={()=>setResetting(false)}>취소</button></div>}
  <div className="closing-overview"><label>마감 날짜<input aria-label="마감 날짜" type="date" value={date} onInput={e=>{const value=e.currentTarget.value;if(/^\d{4}-\d{2}-\d{2}$/.test(value))setDate(value);}} onChange={e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))setDate(e.target.value);}}/></label><strong>{completed}<span> / {allIds.length} 완료</span></strong><progress aria-label="마감 진행률" max={allIds.length} value={completed}/><p>날짜별로 이 기기에 자동 저장 · 팀원 간 공유되지 않아요.</p>{date&&date!==today()&&<button onClick={()=>setDate(today())}>오늘 날짜로 돌아가기</button>}</div>
  {storageError&&<p className="closing-warning" role="alert">{storageError}</p>}
  {!loaded?<p role="status">마감 기록을 불러오는 중…</p>:steps.map((step,index)=><section className="closing-step" key={step.title}>
   <div className="closing-step-title"><span>{String(index+1).padStart(2,'0')}</span><div><h2>{step.title}</h2><p>{step.hint}</p></div><small>{step.items.filter(([id])=>day.checks[id]).length}/{step.items.length}</small></div>
   {index===4&&<div className="closing-calculator"><h3>오늘 달성률</h3><div className="closing-fields"><label>당일 목표 (만원)<input inputMode="decimal" value={wanValue('target')} onChange={e=>updateWan('target',e.target.value)} placeholder="예: 100"/></label><label>당일 매출 (만원)<input inputMode="decimal" value={wanValue('sales')} onChange={e=>updateWan('sales',e.target.value)} placeholder="예: 92.4"/></label></div><p className="achievement">{rate===null?'목표와 매출을 입력하세요':`${rate.toFixed(1)}%`}<small>입력 단위: 만원 · 매출 ÷ 목표 × 100</small></p>{day.target!==''&&Number(day.target)===0&&<p className="closing-warning">목표는 0만원보다 큰 금액으로 입력하세요.</p>}</div>}
   {step.items.filter(([id])=>id!=='sent').map(([id,label])=><label key={id} ref={el=>{itemRefs.current[id]=el;}} tabIndex={-1} className={'closing-check '+(day.checks[id]?'done':'')+(highlight===id?' jump-highlight':'')}><input type="checkbox" checked={!!day.checks[id]} onChange={e=>update({checks:{...day.checks,[id]:e.target.checked}})}/><span>{label}</span>{day.checks[id]&&<Check size={16}/>}</label>)}
   {index===6&&<div className="closing-report"><label className="closing-transfer">명일 이체금액 (원)<input type="text" inputMode="numeric" value={day.transfer} onChange={e=>number(e.target.value,v=>update({transfer:v}))} placeholder="엑셀에서 확인한 금액"/><small>컴퓨터 엑셀로 정산한 최종 금액을 입력하세요.</small></label><fieldset><legend>마감 이상 여부</legend><label><input type="radio" name="closing-status" checked={day.status==='ok'} onChange={()=>update({status:'ok'})}/> 이상 없음</label><label><input type="radio" name="closing-status" checked={day.status==='issue'} onChange={()=>update({status:'issue'})}/> 특이사항 있음</label></fieldset>{day.status==='issue'&&<label className="closing-issue">특이사항<textarea value={day.issue} onChange={e=>update({issue:e.target.value})} placeholder="보고할 내용을 적어 주세요" maxLength={1000}/></label>}<label className="closing-check"><input type="checkbox" checked={day.includeRate} onChange={e=>update({includeRate:e.target.checked})}/><span>달성률도 보고에 포함</span></label><label className="closing-issue">보고 문구 미리보기<textarea ref={reportText} aria-label="마감 보고 문구" readOnly value={message} placeholder="이체금액과 마감 이상 여부를 입력하면 보고 문구가 완성돼요." rows={5}/></label><button className="primary copy-closing" disabled={!message} onClick={copy}><Copy size={18}/>마감 보고 복사</button><p className="muted">복사 후 카톡에 붙여넣어 전송하세요.{completed<allIds.length-1?' 아직 체크하지 않은 항목도 확인해 주세요.':''}</p><label ref={el=>{itemRefs.current.sent=el;}} tabIndex={-1} className={'closing-check '+(day.checks.sent?'done':'')+(highlight==='sent'?' jump-highlight':'')}><input type="checkbox" checked={!!day.checks.sent} onChange={e=>update({checks:{...day.checks,sent:e.target.checked}})}/><span>마감 보고 전송 완료</span></label></div>}
  </section>)}
  {notice&&<div className="toast" role="status">{notice}</div>}
  <button className="closing-jump" disabled={!loaded||!firstUnchecked} onClick={jumpToFirst} aria-label={firstUnchecked?`미완료 ${allIds.length-completed}개 · 첫 미완료 항목으로 이동`:'마감 체크리스트 모두 완료'}>{firstUnchecked?<>미완료 <b>{allIds.length-completed}</b><small>첫 항목으로 ↑</small></>:<>✓ 모두 완료</>}</button>
 </section>;
}
