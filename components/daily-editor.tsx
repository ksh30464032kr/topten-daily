'use client';
import {useEffect,useRef,useState} from 'react';
import {parseDailyPaste,dailyPasteTemplate} from '../lib/daily-paste.mjs';
import {X,Upload} from 'lucide-react';
import type {Report} from '../lib/report';
import {API_BASE,fetchDaily,today} from '../lib/daily';

type Entry={code:string;quantity:string};
const entries=(report:Report|null):Entry[]=>Array.from({length:5},(_,i)=>({code:report?.storeRanking[i]?.code||'',quantity:String(report?.storeRanking[i]?.quantity??'')}));
const SESSION='topten.admin.session';

export default function DailyEditor({mode,initial,onClose,onSave}:{mode:'admin'|'manual';initial:Report|null;onClose:()=>void;onSave:(report:Report)=>void}){
 const admin=mode==='admin';
 const [paste,setPaste]=useState(''),[pasteHint,setPasteHint]=useState(''),[pasteDate,setPasteDate]=useState('');
 function applyPaste(confirmDate=false){try{const value=parseDailyPaste(paste,date,true);if(value.date!==date&&!confirmDate){setPasteDate(value.date);setPasteHint('사진 날짜와 오늘 날짜가 다릅니다. 오늘 등록할 내용이 맞는지 확인해 주세요.');return;}setPasteDate('');setRows(value.rows);setTarget(value.target);setConfirmed(false);setHint('');setError('');setPasteHint('입력칸에 반영했습니다. 빈칸과 목표금액을 확인한 뒤 공유 저장하세요.');}catch(e){setPasteHint(e instanceof Error?e.message:'붙여넣기 형식을 확인해 주세요.');}}
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[rows,setRows]=useState(()=>entries(initial));
 const [target,setTarget]=useState(initial?.targetAmount?String(initial.targetAmount/10000):''),[confirmed,setConfirmed]=useState(!!initial?.targetConfirmed);
 const [revision,setRevision]=useState('0'),[loaded,setLoaded]=useState(!admin),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[hint,setHint]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const [date]=useState(today);
 useEffect(()=>{dialog.current?.showModal();if(admin)setToken(sessionStorage.getItem(SESSION)||'');},[admin]);
 useEffect(()=>{
  if(!admin)return;
  let stopped=false;
  fetchDaily().then(({report})=>{if(stopped)return;setRevision(report?.revision||'0');if(report){setRows(entries(report));setTarget(report.targetAmount?String(report.targetAmount/10000):'');setConfirmed(!!report.targetConfirmed);}setLoaded(true);}).catch(()=>{if(!stopped)setError('현재 공유 내용을 읽지 못했습니다. 창을 닫고 다시 열어 주세요.');});
  return()=>{stopped=true;};
 },[admin]);
 async function login(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{const res=await fetch(API_BASE+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(45_000)});const data=await res.json() as {token:string;error?:string};if(!res.ok)throw Error(data.error);sessionStorage.setItem(SESSION,data.token);setToken(data.token);setPassword('');}
  catch(e){setError(e instanceof Error?e.message:'로그인하지 못했습니다.');}finally{setBusy(false);}
 }
 function expire(){sessionStorage.removeItem(SESSION);setToken('');}
 async function scan(file?:File){
  if(!file||busy)return;setBusy(true);setError('');setHint('');setTarget('');setConfirmed(false);
  try{
   const {analyze}=await import('../services/ocr/browser');
   const report=await analyze(file,setProgress,()=>{});setRows(entries(report as Report));
   if(admin){
    setProgress('목표금액 확인 중');const body=new FormData();body.append('file',file);
    try{const res=await fetch(API_BASE+'/ocr/target',{method:'POST',headers:{Authorization:'Bearer '+token},body,signal:AbortSignal.timeout(90_000)});if(res.status===401){expire();throw Error('관리자 로그인이 만료됐습니다.');}if(!res.ok)throw Error('목표액 자동 인식 실패');const data=await res.json() as {targetAmount?:number;targetHint?:string};setTarget(data.targetAmount?String(data.targetAmount/10000):'');setHint(data.targetHint||'목표액을 확인해 주세요.');}
    catch(e){setHint(e instanceof Error?e.message:'목표액을 직접 입력해 주세요.');}
   }
  }catch(e){setError((e instanceof Error?e.message:'인식하지 못했습니다.')+' 아래에 직접 입력할 수 있습니다.');}
  finally{setBusy(false);setProgress('');if(fileInput.current)fileInput.current.value='';}
 }
 async function save(){
  setError('');
  if(date!==today())return setError('날짜가 바뀌었습니다. 창을 닫고 다시 열어 주세요.');
  if(rows.some(r=>!/^M[SK][A-Z][0-9][A-Z]{2}[0-9]{4}$/.test(r.code.trim().toUpperCase())||!/^\d{1,5}$/.test(r.quantity)))return setError('품번 5개와 판매수량(0 이상 정수)을 확인해 주세요.');
  if(new Set(rows.map(r=>r.code.trim().toUpperCase())).size!==5)return setError('같은 품번은 한 번만 입력해 주세요.');
  const amount=target===''?null:Math.round(Number(target)*10000);
  if(admin&&amount!==null&&(!Number.isFinite(amount)||amount<=0||!confirmed))return setError('목표금액을 확인하고 확인란을 체크해 주세요.');
  const report:Report={id:crypto.randomUUID(),date,createdAt:new Date().toISOString(),store:'우리매장',national:[],products:{},storeRanking:rows.map(r=>({code:r.code.trim().toUpperCase(),quantity:Number(r.quantity),rank:0,rankConfirmed:true,numericConfirmed:true})).map((r,i)=>({...r,rank:i+1})),...(admin?{targetAmount:amount,targetConfirmed:amount!==null,revision}:{})};
  if(!admin){onSave(report);onClose();return;}
  setBusy(true);
  try{const res=await fetch(`${API_BASE}/api/daily/${date}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(report),signal:AbortSignal.timeout(45_000)});const data=await res.json() as {report:Report;error?:string};if(res.status===401)expire();if(!res.ok)throw Error(data.error||'저장하지 못했습니다.');onSave(data.report);onClose();}
  catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="daily-editor" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="sheet-heading"><div><b>{admin?'오늘의 TOP5 관리':'TOP5 직접입력'}</b><small>{date} · {admin?'모든 기기에 공유':'이 기기에서 보기'}</small></div><button disabled={busy} onClick={onClose} aria-label="닫기"><X size={20}/></button></div>
  {admin&&!token?<form onSubmit={login} className="daily-form"><label>관리자 암호<input autoFocus type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy||!password}>{busy?'확인 중…':'관리자 열기'}</button></form>:<>
   {admin&&<><input ref={fileInput} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e=>scan(e.target.files?.[0])}/><button className="primary" disabled={busy||!loaded} onClick={()=>fileInput.current?.click()}><Upload size={16}/>사진으로 채우기</button><p className="muted">표 상단 5개 순서대로 확인하거나 직접 입력하세요.</p></>}
   {admin&&<details className="daily-paste"><summary>GPT 결과 붙여넣기</summary><p>표 상단 5개 순서를 유지합니다. 금액은 원 단위, 불명확한 값은 ‘확인 필요’로 입력하세요.</p><textarea aria-label="GPT 인식 결과" rows={10} value={paste} disabled={busy||!loaded} placeholder={dailyPasteTemplate(date)} onChange={e=>{setPaste(e.target.value);setPasteHint('');setPasteDate('');}}/><div><button className="manual-entry" disabled={busy||!loaded} onClick={()=>{setPaste(dailyPasteTemplate(date));setPasteDate('');setPasteHint('양식을 채우거나 GPT 결과로 바꿔 넣으세요.');}}>빈 양식 넣기</button><button className="primary" disabled={busy||!loaded||!paste.trim()} onClick={()=>applyPaste()}>입력칸에 반영</button></div>{pasteHint&&<p role="status" className="closing-warning">{pasteHint}</p>}{pasteDate&&<div className="paste-date-confirm"><p>사진 날짜: <b>{pasteDate}</b><br/>등록 날짜: <b>{date} (오늘)</b></p><button type="button" className="primary" disabled={busy||!loaded} onClick={()=>applyPaste(true)}>오늘 등록할 내용이 맞습니다 · 반영</button><small>지난 날짜의 기록은 저장하지 않습니다. 날짜가 잘못 인식됐거나 오늘 사용할 자료일 때만 눌러 주세요.</small></div>}<small>자동 저장되지 않습니다. 아래 입력칸에서 수정할 수 있어요.</small></details>}
   <div className="daily-entries">{rows.map((row,i)=><div key={i}><span>{i+1}</span><input aria-label={`${i+1}번째 품번`} placeholder="MSG4TS2312" maxLength={10} value={row.code} disabled={busy} onChange={e=>setRows(rows.map((r,j)=>j===i?{...r,code:e.target.value.toUpperCase()}:r))}/><input aria-label={`${i+1}번째 판매수량`} placeholder="수량" inputMode="numeric" maxLength={5} value={row.quantity} disabled={busy} onChange={e=>{if(/^\d*$/.test(e.target.value))setRows(rows.map((r,j)=>j===i?{...r,quantity:e.target.value}:r));}}/></div>)}</div>
   {admin&&<div className="daily-form"><label>오늘 목표금액 (만원)<input inputMode="decimal" placeholder="예: 100 → 1,000,000원" value={target} disabled={busy} onChange={e=>{if(/^\d{0,7}(\.\d{0,4})?$/.test(e.target.value)){setTarget(e.target.value);setConfirmed(false);}}}/></label>{hint&&<small>{hint}</small>}{target!==''&&<label className="daily-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>{Number.isFinite(Number(target))?(Number(target)*10000).toLocaleString():'—'}원으로 확인했습니다</label>}<small>확인된 목표액만 1층 마감에 자동 입력됩니다. 모르면 비워 두세요.</small></div>}
   <button className="primary daily-save" disabled={busy||!loaded} onClick={save}>{busy?'처리 중…':admin?'오늘 TOP5 공유 저장':'입력 완료'}</button>
   {admin&&<button className="daily-logout" disabled={busy} onClick={expire}>관리자 잠금</button>}
  </>}
  {progress&&<p role="status">{progress}</p>}{error&&<p className="closing-warning" role="alert">{error}</p>}
 </dialog>;
}
