import type {Report} from './report';
export const API_BASE=(process.env.NEXT_PUBLIC_API_BASE||'http://127.0.0.1:8765').replace(/\/$/,'');
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function fetchDaily(date='today',signal?:AbortSignal):Promise<{date:string;report:Report|null}>{
 const res=await fetch(`${API_BASE}/api/daily/${date}`,{cache:'no-store',signal:signal||AbortSignal.timeout(45_000)});
 if(!res.ok)throw Error('공유 리포트를 불러오지 못했습니다.');
 return res.json();
}
