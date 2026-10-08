'use client';
import {useEffect,useRef,useState} from 'react';
import {Clock,Expand,Upload,X,ZoomIn,ZoomOut} from 'lucide-react';
import {API_BASE,today} from '../lib/daily';

type Schedule={date:string;photo?:string;revision:string};
const SESSION='topten.admin.session';
async function getSchedule(date:string,signal?:AbortSignal):Promise<Schedule|null>{
 const res=await fetch(`${API_BASE}/api/schedule/${date}`,{cache:'no-store',signal:signal||AbortSignal.timeout(45_000)});
 if(!res.ok)throw Error('시간표를 불러오지 못했습니다. 다시 시도해 주세요.');
 return ((await res.json()) as {schedule:Schedule|null}).schedule;
}
async function preparePhoto(file:File):Promise<string>{
 if(file.size>25*1024*1024)throw Error('25MB 이하 사진을 선택해 주세요.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  const scale=Math.min(1,4000/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const photo=canvas.toDataURL('image/jpeg',.94);
  if(photo.length>8*1024*1024)throw Error('사진 용량이 큽니다. 크기를 줄여 다시 선택해 주세요.');
  return photo;
 }finally{URL.revokeObjectURL(url);}
}
export default function SchedulePanel({adminRequest}:{adminRequest:number}){
 const [date,setDate]=useState(today),[schedule,setSchedule]=useState<Schedule|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState(false),[refresh,setRefresh]=useState(0),[zoom,setZoom]=useState(1),[expanded,setExpanded]=useState(false);
 const seen=useRef(adminRequest),lastToday=useRef(today()),viewer=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(adminRequest!==seen.current){seen.current=adminRequest;setEditing(true);}},[adminRequest]);
 useEffect(()=>{const controller=new AbortController();setSchedule(null);setLoading(true);setError('');setZoom(1);getSchedule(date,AbortSignal.any([controller.signal,AbortSignal.timeout(45_000)])).then(v=>{if(!controller.signal.aborted)setSchedule(v);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[date,refresh]);
 useEffect(()=>{const check=()=>{if(document.visibilityState!=='visible'||editing||expanded)return;const next=today(),previous=lastToday.current;if(next!==previous){setDate(d=>d===previous?next:d);lastToday.current=next;}setRefresh(n=>n+1);};const timer=setInterval(()=>{if(today()!==lastToday.current)check();},60_000);document.addEventListener('visibilitychange',check);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);};},[editing,expanded]);
 useEffect(()=>{if(expanded)viewer.current?.showModal();else viewer.current?.close();},[expanded]);
 const controls=<><button aria-label="시간표 축소" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-.5))}><ZoomOut size={20}/></button><button onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="시간표 확대" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z+.5))}><ZoomIn size={20}/></button></>;
 const photo=schedule?.photo;
 return <section className="schedule-panel schedule-photo-panel"><div className="eyebrow">OUR WORKDAY</div><h1>시간표</h1><p className="subtitle">등록된 원본 사진으로 근무시간과 휴게시간을 확인하세요.</p>
  <div className="schedule-controls"><label>날짜<input type="date" value={date} disabled={editing} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label><button className="manual-entry" onClick={()=>{setDate(today());setRefresh(n=>n+1);}}>오늘</button></div>
  {loading?<p role="status">시간표를 불러오는 중…</p>:error?<div role="alert" className="closing-warning">{error}<button onClick={()=>setRefresh(n=>n+1)}>다시 불러오기</button></div>:!photo?<div className="schedule-empty"><Clock size={32}/><h2>등록된 시간표 사진이 없어요</h2><p>관리자가 이 날짜의 사진을 등록하면 모두에게 표시됩니다.</p></div>:<><div className="schedule-photo-tools"><span>확대 후 좌우로 움직여 보세요</span>{controls}<button onClick={()=>setExpanded(true)}><Expand size={18}/>크게 보기</button></div><div className="schedule-photo-scroll"><img src={photo} alt={`${date} 근무 시간표`} style={{width:`${zoom*100}%`}} onClick={()=>setExpanded(true)}/></div></>}
  <dialog ref={viewer} className="schedule-photo-dialog" onCancel={()=>setExpanded(false)}><div className="schedule-photo-tools"><b>{date} 시간표</b>{controls}<button aria-label="시간표 닫기" onClick={()=>setExpanded(false)}><X size={22}/></button></div><div className="schedule-photo-scroll">{photo&&<img src={photo} alt={`${date} 시간표 확대`} style={{width:`${zoom*100}%`}}/>}</div></dialog>
  {editing&&<ScheduleEditor date={date} onClose={()=>setEditing(false)} onSave={value=>{setDate(value.date);setSchedule(value);setError('');setLoading(false);setZoom(1);setEditing(false);}}/>}
 </section>;
}
function ScheduleEditor({date,onClose,onSave}:{date:string;onClose:()=>void;onSave:(value:Schedule)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const [saveDate,setSaveDate]=useState(date),[photo,setPhoto]=useState(''),[revision,setRevision]=useState('0'),[token,setToken]=useState(''),[password,setPassword]=useState(''),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{dialog.current?.showModal();try{setToken(sessionStorage.getItem(SESSION)||'');}catch{}},[]);
 useEffect(()=>{let stopped=false;setLoaded(false);setError('');getSchedule(saveDate).then(value=>{if(stopped)return;setPhoto(value?.photo||'');setRevision(value?.revision||'0');setLoaded(true);}).catch(e=>{if(!stopped)setError(e.message);});return()=>{stopped=true;};},[saveDate,retry]);
 function expire(){setToken('');try{sessionStorage.removeItem(SESSION);}catch{}}
 async function login(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const res=await fetch(API_BASE+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(45_000)});const data=await res.json() as {token:string;error?:string};if(!res.ok)throw Error(data.error||'로그인하지 못했습니다.');setToken(data.token);setPassword('');try{sessionStorage.setItem(SESSION,data.token);}catch{}}catch(e){setError(e instanceof Error?e.message:'로그인하지 못했습니다.');}finally{setBusy(false);}}
 async function select(file?:File){if(!file)return;setBusy(true);setError('');try{setPhoto(await preparePhoto(file));}catch(e){setError(e instanceof Error?e.message:'사진을 열지 못했습니다. JPG 또는 PNG 사진을 선택해 주세요.');}finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}}
 async function save(event:React.FormEvent){event.preventDefault();if(!photo)return;setBusy(true);setError('');try{const res=await fetch(`${API_BASE}/api/schedule/${saveDate}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({date:saveDate,photo,revision}),signal:AbortSignal.timeout(60_000)});const data=await res.json() as {schedule:Schedule;error?:string};if(res.status===401)expire();if(!res.ok)throw Error(data.error||'저장하지 못했습니다.');onSave(data.schedule);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{setBusy(false);}}
 return <dialog ref={dialog} className="daily-editor schedule-editor" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><div className="sheet-heading"><div><b>시간표 사진 등록</b><small>날짜별로 모든 기기에 공유</small></div><button disabled={busy} onClick={onClose} aria-label="닫기"><X size={20}/></button></div>
 {!token?<form className="daily-form" onSubmit={login}><label>관리자 암호<input autoFocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>관리자 열기</button></form>:<form onSubmit={save}><fieldset disabled={busy} className="schedule-fields"><label>사진의 날짜<input required type="date" value={saveDate} onChange={e=>{if(e.target.value)setSaveDate(e.target.value);}}/></label><p>사진에 적힌 날짜를 선택한 뒤 등록하세요. OCR 없이 사진 그대로 공유합니다.</p>{!loaded?<button type="button" className="manual-entry" onClick={()=>setRetry(n=>n+1)}>시간표 다시 불러오기</button>:<><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>void select(e.target.files?.[0])}/><button type="button" className="primary" onClick={()=>fileInput.current?.click()}><Upload size={17}/>{photo?'다른 사진 선택':'시간표 사진 선택'}</button>{photo&&<img className="schedule-upload-preview" src={photo} alt="저장할 시간표 사진 미리보기"/>}<p>이름과 시간이 잘 보이는 원본 사진을 권장합니다. 저장하면 해당 날짜의 시간표가 이 사진으로 바뀝니다.</p><button type="submit" className="primary daily-save" disabled={!photo}>{busy?'사진 저장 중…':'시간표 사진 공유 저장'}</button></>}<button type="button" className="daily-logout" onClick={expire}>관리자 잠금</button></fieldset></form>}{error&&<p role="alert" className="closing-warning">{error}</p>}</dialog>;
}
