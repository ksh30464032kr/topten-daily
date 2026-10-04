import type {Report} from '../../lib/report';

const OCR_URL=(process.env.NEXT_PUBLIC_API_BASE||'http://127.0.0.1:8765').replace(/\/$/,'');
let lastFile:File|undefined;

export function release(){lastFile=undefined;}

function previewFile(file:File,preview:(url:string)=>void){
  if(file.type.startsWith('image/')){
    const reader=new FileReader();reader.onload=()=>preview(String(reader.result||''));reader.readAsDataURL(file);
  }
}

async function post(path:string,file:File,extra:Record<string,string>={}){
  const form=new FormData();form.append('file',file,file.name);for(const [k,v] of Object.entries(extra))form.append(k,v);
  let res:Response;
  try{res=await fetch(OCR_URL+path,{method:'POST',body:form});}
  catch{throw Error('OCR 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
  let data:any={};try{data=await res.json();}catch{}
  if(!res.ok)throw Error(data?.error||'로컬 OCR 처리 중 오류가 발생했습니다.');
  return data;
}

export async function analyze(file:File,progress:(s:string)=>void,preview:(url:string)=>void):Promise<Omit<Report,'id'|'createdAt'|'products'>>{
  if(file.size>25*1024*1024)throw Error('25MB 이하의 파일을 선택해 주세요.');
  if(!['image/png','image/jpeg'].includes(file.type))throw Error('현재 로컬 OCR 버전은 JPG, JPEG, PNG 리포트를 지원합니다.');
  lastFile=file;previewFile(file,preview);
  progress('PaddleOCR 연결 중');
  const data=await post('/ocr/report',file);
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
