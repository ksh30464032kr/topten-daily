import type {Report} from '../../lib/report';

const OCR_URL=(process.env.NEXT_PUBLIC_API_BASE||'http://127.0.0.1:8765').replace(/\/$/,'');
let lastFile:File|undefined;
let warming:Promise<void>|undefined;
let readyAt=0;

// One request on page entry overlaps cold start with selecting the report.
// No periodic polling or keep-alive requests while the site is idle.
export function warmup():Promise<void>{
  if(Date.now()-readyAt<60_000)return Promise.resolve();
  if(warming)return warming;
  warming=(async()=>{
    try{
      const res=await fetch(OCR_URL+'/health',{cache:'no-store',signal:AbortSignal.timeout(90_000)});
      if(!res.ok)throw Error();
      const data=await res.json() as {ok?:boolean};
      if(data.ok!==true)throw Error();
      readyAt=Date.now();
    }catch{throw Error('OCR 서버를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
    finally{warming=undefined;}
  })();
  return warming;
}

export function release(){lastFile=undefined;}

function previewFile(file:File,preview:(url:string)=>void){
  if(file.type.startsWith('image/')){
    const reader=new FileReader();reader.onload=()=>preview(String(reader.result||''));reader.readAsDataURL(file);
  }
}

async function post(path:string,file:File,extra:Record<string,string>={}){
  const form=new FormData();form.append('file',file,file.name);for(const [k,v] of Object.entries(extra))form.append(k,v);
  let res:Response;
  try{res=await fetch(OCR_URL+path,{method:'POST',body:form,signal:AbortSignal.timeout(300_000)});}
  catch(error){
    if(error instanceof Error && error.name==='TimeoutError')throw Error('OCR 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    throw Error('OCR 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  let data:any={};try{data=await res.json();}catch{}
  if(!res.ok)throw Error(data?.error||'OCR 서버에서 처리 중 오류가 발생했습니다.');
  return data;
}

export async function analyze(file:File,progress:(s:string)=>void,preview:(url:string)=>void):Promise<Omit<Report,'id'|'createdAt'|'products'>>{
  if(file.size>25*1024*1024)throw Error('25MB 이하의 파일을 선택해 주세요.');
  if(!['image/png','image/jpeg'].includes(file.type))throw Error('JPG, JPEG, PNG 리포트를 지원합니다.');
  lastFile=file;previewFile(file,preview);
  progress('OCR 서버 준비 중');
  await warmup();
  const started=Date.now();
  progress('이미지 전송 및 TOP5 품번·판매수량 인식 중');
  const timer=setInterval(()=>progress(`TOP5 인식 요청 처리 중 · ${Math.floor((Date.now()-started)/1000)}초 경과`),1000);
  let data;
  try{data=await post('/ocr/report',file);}finally{clearInterval(timer);}
  progress('우리 매장 TOP5 품번·판매수량 인식 완료');
  return {date:data.date||'',store:data.store||'',national:[],storeRanking:data.storeRanking||[]};
}

export async function retryCell(rect:any,progress:(s:string)=>void){
  if(!lastFile)throw Error('원본 리포트를 다시 업로드해 주세요.');
  progress('PaddleOCR로 품번 다시 읽는 중');
  return post('/ocr/cell',lastFile,{rect:JSON.stringify(rect),kind:'code'});
}

export async function retryNumber(rect:any){
  if(!lastFile)throw Error('원본 리포트를 다시 업로드해 주세요.');
  const r=await post('/ocr/cell',lastFile,{rect:JSON.stringify(rect),kind:'number'});
  return {value:r.value??null,confirmed:r.value!=null,rect,readings:r.readings||[]};
}
