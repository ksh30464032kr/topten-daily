'use client';
import {useEffect,useRef,useState} from 'react';
import {Clock,Plus,X,Upload} from 'lucide-react';
import ScheduleAlarms from './schedule-alarms';
import {API_BASE,today} from '../lib/daily';

type Pause={start:string;end:string};
type Person={name:string;off:boolean;start:string;end:string;breaks:Pause[]};
type Schedule={date:string;staff:Person[];revision:string};
const SESSION='topten.admin.session',SELF='topten.schedule.self';
const blank=():Person=>({name:'',off:false,start:'',end:'',breaks:[]});
async function getSchedule(date:string,signal?:AbortSignal):Promise<Schedule|null>{
 const res=await fetch(`${API_BASE}/api/schedule/${date}`,{cache:'no-store',signal:signal||AbortSignal.timeout(45_000)});
 if(!res.ok)throw Error('시간표를 불러오지 못했습니다. 다시 시도해 주세요.');
 return ((await res.json()) as {schedule:Schedule|null}).schedule;
}

export default function SchedulePanel({adminRequest}:{adminRequest:number}){
 const [date,setDate]=useState(today),[schedule,setSchedule]=useState<Schedule|null>(null),[name,setName]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState(false),[refresh,setRefresh]=useState(0);
 const seen=useRef(adminRequest),lastToday=useRef(today());
 useEffect(()=>{try{setName(localStorage.getItem(SELF)||'');}catch{}},[]);
 useEffect(()=>{if(adminRequest!==seen.current){seen.current=adminRequest;setEditing(true);}},[adminRequest]);
 useEffect(()=>{
  const controller=new AbortController();setSchedule(null);setLoading(true);setError('');
  getSchedule(date,AbortSignal.any([controller.signal,AbortSignal.timeout(45_000)])).then(value=>{if(!controller.signal.aborted)setSchedule(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[date,refresh]);
 useEffect(()=>{
  const check=()=>{if(document.visibilityState!=='visible'||editing)return;const next=today(),previous=lastToday.current;if(next!==previous){setDate(d=>d===previous?next:d);lastToday.current=next;}setRefresh(n=>n+1);};
  const timer=setInterval(()=>{if(today()!==lastToday.current)check();},60_000);
  document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);};
 },[editing]);
 const person=schedule?.staff.find(p=>p.name===name);
 return <section className="schedule-panel">
  <div className="eyebrow">MY WORKDAY</div><h1>내 시간표</h1><p className="subtitle">이름을 선택하면 근무시간과 휴게시간을 바로 확인할 수 있어요.</p>
  <div className="schedule-controls"><label>날짜<input type="date" value={date} disabled={editing} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label><button className="manual-entry" onClick={()=>{setDate(today());setRefresh(n=>n+1);}}>오늘</button></div>
  {loading?<p role="status">시간표를 불러오는 중…</p>:error?<div className="closing-warning" role="alert">{error}<button className="manual-entry" onClick={()=>setRefresh(n=>n+1)}>다시 불러오기</button></div>:!schedule?<div className="schedule-empty"><Clock size={32}/><h2>{date===today()?'오늘':'선택한 날짜'}의 시간표가 아직 없어요</h2><p>관리자가 등록하면 여기에 표시됩니다.</p></div>:<>
   <label className="schedule-name">나는 누구인가요?<select value={name} onChange={e=>{setName(e.target.value);try{localStorage.setItem(SELF,e.target.value);}catch{}}}><option value="">이름 선택</option>{name&&!person&&<option value={name}>{name} (이 날짜에 등록 없음)</option>}{schedule.staff.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
   {person?<article className="schedule-card"><div className="schedule-card-heading"><h2>{person.name}</h2><span>{date} {date===today()?'· 오늘':''}</span></div>{person.off?<strong className="schedule-hours">휴무</strong>:<><div className="schedule-time-row"><span>출근 → 퇴근</span><strong className="schedule-hours">{person.start} — {person.end}</strong></div><div className="schedule-time-row"><span>휴게시간</span>{person.breaks.length?person.breaks.map((pause,i)=><strong key={i} className="schedule-break">{pause.start} — {pause.end}</strong>):<strong>등록된 휴게시간 없음</strong>}</div><ScheduleAlarms date={date} person={person}/></>}</article>:<p className="muted">{name?'선택한 날짜의 시간표에 내 이름이 없습니다. 관리자에게 확인해 주세요.':'위에서 내 이름을 선택해 주세요. 이 기기에서 선택을 기억합니다.'}</p>}
  </>}
  {editing&&<ScheduleEditor date={date} onClose={()=>setEditing(false)} onSave={value=>{setDate(value.date);setSchedule(value);setError('');setLoading(false);setEditing(false);}}/>}
 </section>;
}

function ScheduleEditor({date,onClose,onSave}:{date:string;onClose:()=>void;onSave:(value:Schedule)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const [saveDate,setSaveDate]=useState(date),[scanHint,setScanHint]=useState(''),[scanned,setScanned]=useState(false),[confirmed,setConfirmed]=useState(false),[scanning,setScanning]=useState(false),[elapsed,setElapsed]=useState(0);
 useEffect(()=>{if(!scanning)return;const began=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-began)/1000)),1000);return()=>clearInterval(timer);},[scanning]);
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[staff,setStaff]=useState<Person[]>([blank()]),[revision,setRevision]=useState('0');
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{dialog.current?.showModal();try{setToken(sessionStorage.getItem(SESSION)||'');}catch{}},[]);
 useEffect(()=>{let stopped=false;setLoaded(false);setError('');getSchedule(date).then(value=>{if(stopped)return;setStaff(value?.staff||[blank()]);setRevision(value?.revision||'0');setLoaded(true);}).catch(e=>{if(!stopped)setError(e.message);});return()=>{stopped=true;};},[date,retry]);
 function expire(){setToken('');try{sessionStorage.removeItem(SESSION);}catch{}}
 async function login(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const res=await fetch(API_BASE+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(45_000)});const data=await res.json() as {token:string;error?:string};if(!res.ok)throw Error(data.error||'로그인하지 못했습니다.');setToken(data.token);setPassword('');try{sessionStorage.setItem(SESSION,data.token);}catch{}}catch(e){setError(e instanceof Error?e.message:'로그인하지 못했습니다.');}finally{setBusy(false);}}
 function change(index:number,patch:Partial<Person>){setConfirmed(false);setStaff(prev=>prev.map((p,i)=>i===index?{...p,...patch}:p));}
 async function save(event:React.FormEvent){event.preventDefault();if(scanned&&!confirmed){setError('원본과 대조한 뒤 확인란을 체크해 주세요.');return;}setBusy(true);setError('');try{const res=await fetch(`${API_BASE}/api/schedule/${saveDate}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({date:saveDate,staff,revision}),signal:AbortSignal.timeout(45_000)});const data=await res.json() as {schedule:Schedule;error?:string};if(res.status===401)expire();if(!res.ok)throw Error(data.error||'저장하지 못했습니다.');onSave(data.schedule);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{setBusy(false);}}
 async function changeDate(next:string){
  if(!next)return;setBusy(true);setError('');
  try{const current=await getSchedule(next);setRevision(current?.revision||'0');setSaveDate(next);setConfirmed(false);}catch(e){setError(e instanceof Error?e.message:'날짜를 확인하지 못했습니다.');}finally{setBusy(false);}
 }
 async function scan(file?:File){
  if(!file||busy)return;
  if(file.size>25*1024*1024){setError('25MB 이하의 사진을 올려 주세요.');return;}
  setBusy(true);setScanning(true);setError('');setScanHint('');
  try{const body=new FormData();body.append('file',file);const res=await fetch(API_BASE+'/ocr/schedule',{method:'POST',headers:{Authorization:'Bearer '+token},body,signal:AbortSignal.timeout(300_000)});const data=await res.json() as {date:string;staff:Person[];warnings:string[];hint:string;error?:string};if(res.status===401)expire();if(!res.ok)throw Error(data.error||'인식하지 못했습니다.');
   const nextDate=data.date||saveDate;const current=await getSchedule(nextDate);
   setRevision(current?.revision||'0');setSaveDate(nextDate);setStaff(data.staff);setScanned(true);setConfirmed(false);setScanHint([data.hint,...data.warnings,current?'해당 날짜의 기존 시간표는 공유 저장 시 교체됩니다.':''].filter(Boolean).join('\n'));
  }catch(e){setError((e instanceof Error?e.message:'시간표 인식에 실패했습니다.')+' 직접 입력할 수도 있습니다.');}
  finally{setBusy(false);setScanning(false);if(fileInput.current)fileInput.current.value='';}
 }
 return <dialog ref={dialog} className="daily-editor schedule-editor" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="sheet-heading"><div><b>시간표 관리</b><small>{saveDate} · 모든 기기에 공유</small></div><button disabled={busy} onClick={onClose} aria-label="닫기"><X size={20}/></button></div>
  {!token?<form className="daily-form" onSubmit={login}><label>관리자 암호<input autoFocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>관리자 열기</button></form>:!loaded?<><p>시간표를 불러와야 수정할 수 있습니다.</p><button className="manual-entry" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button></>:<form onSubmit={save}><fieldset disabled={busy} className="schedule-fields">
   <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e=>scan(e.target.files?.[0])}/>
   <button className="primary" type="button" onClick={()=>fileInput.current?.click()}><Upload size={16}/>{scanning?'시간표 인식 중…':'시간표 사진으로 채우기'}</button>
   <p role="status">{scanning?`시간표 인식 중 · ${elapsed}초 (첫 실행은 더 걸릴 수 있습니다.)`:''}</p><p>이름과 시간표가 모두 보이는 가로 원본을 올려 주세요. 인식 후 수정할 수 있습니다.</p>
   <label>저장 날짜<input required type="date" value={saveDate} onChange={e=>void changeDate(e.target.value)}/></label>
   {scanHint&&<p className="closing-warning" style={{whiteSpace:'pre-line'}}>{scanHint}</p>}

   {staff.map((person,i)=><div className="schedule-person" key={i}><div className="schedule-person-heading"><label>이름<input required maxLength={30} value={person.name} onChange={e=>change(i,{name:e.target.value})}/></label><label className="schedule-off"><input type="checkbox" checked={person.off} onChange={e=>change(i,{off:e.target.checked})}/>휴무</label><button type="button" disabled={staff.length===1} aria-label={`${person.name||i+1} 삭제`} onClick={()=>setStaff(staff.filter((_,j)=>i!==j))}><X size={18}/></button></div>
    {!person.off&&<><div className="schedule-input-row"><label>출근<input required type="time" value={person.start} onChange={e=>change(i,{start:e.target.value})}/></label><label>퇴근<input required type="time" value={person.end} onChange={e=>change(i,{end:e.target.value})}/></label></div>{person.breaks.map((pause,j)=><div className="schedule-input-row" key={j}><label>휴게 시작<input required type="time" value={pause.start} onChange={e=>change(i,{breaks:person.breaks.map((p,k)=>k===j?{...p,start:e.target.value}:p)})}/></label><label>휴게 종료<input required type="time" value={pause.end} onChange={e=>change(i,{breaks:person.breaks.map((p,k)=>k===j?{...p,end:e.target.value}:p)})}/></label><button type="button" aria-label="휴게 삭제" onClick={()=>change(i,{breaks:person.breaks.filter((_,k)=>k!==j)})}><X size={16}/></button></div>)}<button className="manual-entry" type="button" disabled={person.breaks.length>=5} onClick={()=>change(i,{breaks:[...person.breaks,{start:'',end:''}]})}>+ 휴게시간</button></>}
   </div>)}
   <button className="manual-entry" type="button" disabled={staff.length>=50} onClick={()=>setStaff([...staff,blank()])}><Plus size={16}/>근무자 추가</button>{scanned&&<label className="daily-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>날짜·이름·근무·휴게시간을 원본과 대조했습니다</label>}<button className="primary daily-save" type="submit">{scanning?'사진 인식 중…':busy?'저장 중…':'시간표 공유 저장'}</button><button className="daily-logout" type="button" onClick={expire}>관리자 잠금</button>
  </fieldset></form>}
  {error&&<p className="closing-warning" role="alert">{error}</p>}
 </dialog>;
}
