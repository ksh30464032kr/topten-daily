'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Upload,Search,Star,Clock,Home,ScanLine,ArrowUpRight,X,Check,Copy,BookOpen,ChevronRight,ImageIcon,Plus,LoaderCircle,SlidersHorizontal,Store,Globe,ClipboardCheck} from 'lucide-react';
import type {Product} from '../services/topten';
import type {Row,Report} from '../lib/report';
import ProductCard from '../components/product-card';
import ReportReview from '../components/report-review';
import {validation} from '../services/ocr/validation.mjs';
import {productStorage} from '../lib/product-storage';
import {fetchDaily,today} from '../lib/daily';
const DailyEditor=lazy(()=>import('../components/daily-editor'));
const BriefingDialog=lazy(()=>import('../components/briefing-dialog'));
import {validCode} from '../services/ocr/geometry.mjs';
const API_BASE=(process.env.NEXT_PUBLIC_API_BASE||'http://127.0.0.1:8765').replace(/\/$/,'');

const ClosingChecklist=lazy(()=>import('../components/closing-hub'));
const HISTORY='topten.reports.v1',FAVS='topten.favorites.v1',CACHE='topten.products.v1';
const searchLink=(code:string)=>'https://display-topten10.goodwearmall.com/search?keyword='+encodeURIComponent(code);
function read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function Thumb({p,onClick}:{p?:Product;onClick?:()=>void}){const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[p?.image,p?.checkedAt]);return <button className="photo" onClick={onClick} aria-label={p?.name?`${p.name} 사진 크게 보기`:'상품 사진 확인'}>{p?.image&&!bad?<img src={p.image} alt={p.name||p.code} width={300} height={400} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setBad(true)}/>:<span className="placeholder">{!p?<LoaderCircle className="spin" size={24}/>:<ImageIcon size={26} strokeWidth={1}/>}<span>{!p?'상품 찾는 중':p.status==='error'?'연결 ':'사진 '}</span></span>}<span className="zoom"><Plus size={18}/></span></button>;}
export default function Page(){
 const [reports,setReports]=useState<Report[]>([]),[favorites,setFavorites]=useState<string[]>([]),[products,setProducts]=useState<Record<string,Product>>({}),[report,setReport]=useState<Report|null>(null),[draft,setDraft]=useState<Report|null>(null);
 const [view,setView]=useState('today'),[tab,setTab]=useState('storeRanking'),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[preview,setPreview]=useState(''),[error,setError]=useState(''),[toast,setToast]=useState(''),[query,setQuery]=useState(''),[searched,setSearched]=useState<string|null>(null),[searching,setSearching]=useState(false),[modal,setModal]=useState<string|null>(null),[duplicate,setDuplicate]=useState(false),[study,setStudy]=useState(false),[studyIndex,setStudyIndex]=useState(0),[answer,setAnswer]=useState(false),[drag,setDrag]=useState(false),[hydrated,setHydrated]=useState(false);
 const input=useRef<HTMLInputElement>(null),searchInput=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null),requests=useRef(new Map<string,Promise<Product>>()),productCache=useRef<Record<string,Product>>({});
 const [refreshing,setRefreshing]=useState(false),[briefingOpen,setBriefingOpen]=useState(false),[showProducts,setShowProducts]=useState(false);
 const [editor,setEditor]=useState<'admin'|'manual'|null>(null),[dailyLoading,setDailyLoading]=useState(true),[sharedError,setSharedError]=useState('');
 const logoTaps=useRef({count:0,at:0});
 const editorRef=useRef(editor);editorRef.current=editor;
 function logoClick(){const now=Date.now();logoTaps.current={count:now-logoTaps.current.at<2500?logoTaps.current.count+1:1,at:now};if(logoTaps.current.count>=5){setEditor('admin');logoTaps.current.count=0;}else navigate('today');}
 function acceptReport(next:Report){setReport(next);setReports(prev=>[next,...prev.filter(r=>r.id!==next.id)].slice(0,90));setShowProducts(false);}
 function saveEditor(next:Report){acceptReport(next);setView('today');setToast(next.shared?'오늘 TOP5를 모든 기기에 공유했습니다.':'직접 입력한 TOP5를 저장했습니다.');}
 useEffect(()=>{
  if(!hydrated)return;
  let stopped=false,lastDate=today(),lastCheck=0;
  const controller=new AbortController();
  async function sync(){
   if(editorRef.current)return;
   const date=today();if(date===lastDate&&Date.now()-lastCheck<30_000)return;
   lastDate=date;lastCheck=Date.now();
   setReport(prev=>prev?.date===date?prev:null);
   try{const result=await fetchDaily('today',AbortSignal.any([controller.signal,AbortSignal.timeout(45_000)]));if(stopped||editorRef.current||result.date!==today())return;if(result.report)acceptReport(result.report);setSharedError('');}
   catch{if(!stopped)setSharedError('공유 TOP5를 불러오지 못했어요. 저장된 내용이 있으면 표시합니다.');}
   finally{if(!stopped)setDailyLoading(false);}
  }
  void sync();
  const visible=()=>{if(document.visibilityState==='visible')void sync();};
  const timer=setInterval(()=>{if(today()!==lastDate)void sync();},60_000);
  window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[hydrated]);
 useEffect(()=>{const saved=read<Report[]>(HISTORY,[]);setReports(Array.isArray(saved)?saved:[]);setReport(Array.isArray(saved)?saved.find((r:Report)=>r.date===today())||null:null);setFavorites(read(FAVS,[]));productCache.current=read(CACHE,{});setProducts(productCache.current);setHydrated(true);},[]);
 useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(HISTORY,JSON.stringify(reports));}catch{setError('기기 저장 공간이 부족해 저장하지 못했습니다.');}},[reports,hydrated]);
 useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(FAVS,JSON.stringify(favorites));}catch{setError('즐겨찾기를 저장하지 못했습니다.');}},[favorites,hydrated]);
 useEffect(()=>{if(!hydrated)return;const timer=setTimeout(()=>{try{localStorage.setItem(CACHE,JSON.stringify(products));}catch{}},300);return()=>clearTimeout(timer);},[products,hydrated]);
 useEffect(()=>{if(!hydrated||view==='closing')return;const codes=view==='favorites'?favorites:report?report.storeRanking.slice(0,5).map(r=>r.code):[];let stopped=false;let next=0;const unique=[...new Set(codes)].filter(validCode);void Promise.all(Array.from({length:Math.min(5,unique.length)},async()=>{while(!stopped&&next<unique.length)await lookup(unique[next++]);}));return()=>{stopped=true;};},[hydrated,report?.id,view]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{if(modal||study){dialog.current?.showModal();}else dialog.current?.close();},[modal,study]);
 async function lookup(code:string,force=false){if(requests.current.has(code))return requests.current.get(code)!;const cached=productCache.current[code];const age=cached?Date.now()-Date.parse(cached.checkedAt):Infinity;if(!force&&cached&&((cached.status==='found'&&age<86400000)||(cached.status==='missing'&&age<300000)))return cached;
  const task=(async()=>{let p:Product;try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const res=await fetch(API_BASE+'/api/products/'+encodeURIComponent(code)+(force?'?refresh=1':''),{signal:controller.signal,cache:force?'reload':'default'});if(!res.ok)throw Error();p=await res.json();}finally{clearTimeout(timer);}if(p.status==='error'&&cached?.status==='found')p={...cached,stale:true};}catch{p=cached?.status==='found'?{...cached,stale:true}:{code,status:'error',checkedAt:new Date().toISOString(),url:searchLink(code)};}productCache.current[code]=p;setProducts(prev=>({...prev,[code]:p}));return p;})();requests.current.set(code,task);try{return await task;}finally{requests.current.delete(code);}}
 async function retryProducts(){if(refreshing)return;setRefreshing(true);try{let next=0;const codes=[...new Set(codeRows.map(r=>r.code))];await Promise.all(Array.from({length:Math.min(5,codes.length)},async()=>{while(next<codes.length)await lookup(codes[next++],true);}));}finally{setRefreshing(false);}}
 async function loadProducts(r:Report){const codes=[...new Set(r.storeRanking.slice(0,5).map(x=>x.code))].filter(validCode);const map:Record<string,Product>={};let count=0;let next=0;await Promise.all(Array.from({length:Math.min(5,codes.length)},async()=>{while(next<codes.length){const code=codes[next++];map[code]=await lookup(code);setProgress(`TOPTEN 상품 확인 ${++count}/${codes.length}`);}}));return map;}
 async function upload(file?:File){
  if(!file||busy)return;
  setError('');
  setDraft(null);
  setDuplicate(false);
  setBusy(true);
  setShowProducts(false);
  setView('today');
  try{
    const {analyze}=await import('../services/ocr/browser');
    const result=await analyze(file,setProgress,setPreview);

    // Date/store are no longer OCR targets. Keep simple internal values only
    // so the existing Report type/history logic can continue to work.
    const now=new Date();
    const localDate=today();
    const r:Report={
      ...result,
      date:localDate,
      store:'우리매장',
      id:crypto.randomUUID(),
      createdAt:new Date().toISOString(),
      products:{},
      national:[],
      storeRanking:(result.storeRanking||[]).slice(0,5)
    };

    setReport(r);
    setReports(prev=>[r,...prev].slice(0,90));
    setDraft(null);
    setTab('storeRanking');
    setFilter('all');
    setProgress('');
    setToast('TOP5 인식 완료');
    void import('../services/ocr/browser').then(m=>m.release());
  }catch(e){
    setError(e instanceof Error?e.message:'리포트를 읽지 못했습니다. 다시 업로드해 주세요.');
    setProgress('');
  }finally{
    setBusy(false);
    if(input.current)input.current.value='';
  }
}
 async function saveDraft(replace=false){if(!draft)return;setError('');if(!draft.store.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||Number.isNaN(Date.parse(draft.date))||new Date(draft.date+'T12:00:00Z').toISOString().slice(0,10)!==draft.date)return setError('날짜와 매장명을 확인해 주세요.');if([draft.storeRanking].some(rows=>rows.length!==5||rows.some(r=>!validCode(r.code))||new Set(rows.map(r=>r.code)).size!==5))return setError('각 순위의 품번 5개를 확인해 주세요. 빈 품번이나 같은 목록 안의 중복은 저장할 수 없습니다.');if(!replace&&reports.some(r=>r.date===draft.date&&r.store.trim()===draft.store.trim()))return setDuplicate(true);setBusy(true);try{const loaded=await loadProducts(draft);const finalize=(rows:Row[])=>rows.slice(0,5).map(row=>{try{if(row.originalCode)productStorage.remember(row.originalCode,row.code);}catch{}return {...row,verified:validation(row,loaded[row.code]).verified};});const current={...draft,national:[],storeRanking:finalize(draft.storeRanking),store:draft.store.trim(),products:loaded};void import('../services/ocr/browser').then(m=>m.release());const sorted=[current,...reports.filter(r=>!(r.date===current.date&&r.store===current.store))].sort((a,b)=>b.date.localeCompare(a.date));setReports(sorted.slice(0,90));setReport(current);setDraft(null);setDuplicate(false);setTab('storeRanking');setFilter('all');setToast('리포트가 이 기기에 저장되었습니다.');}finally{setBusy(false);setProgress('');}}
 async function directSearch(e?:React.FormEvent){e?.preventDefault();const code=query.trim().toUpperCase();if(!validCode(code)){setError('영문과 숫자로 된 8~15자리 품번을 입력해 주세요.');return;}setError('');setView('search');setSearched(code);setSearching(true);await lookup(code);setSearching(false);}
 function star(code:string){setFavorites(prev=>prev.includes(code)?prev.filter(x=>x!==code):[...prev,code]);}
 async function copy(code:string){try{await navigator.clipboard.writeText(code);setToast('복사되었습니다.');}catch{window.prompt('아래 내용을 길게 눌러 복사하세요.',code);}}
 function navigate(next:string){setView(next);setFilter('all');if(next==='today')setShowProducts(false);if(next==='search')searchInput.current?.focus();}
 const local=report?.storeRanking.slice(0,5)||[];
 const dateBefore=report?new Date(Date.parse(report.date+'T12:00:00Z')-86400000).toISOString().slice(0,10):'';
 const previous=reports.find(r=>r.store===report?.store&&r.date===dateBefore);
 const showingNational=false;
 function movement(code:string){if(!previous||!report)return '';const old=previous.storeRanking.slice(0,5);const before=old.find(r=>r.code===code);if(!before)return 'NEW';const delta=before.rank-(local.find(r=>r.code===code)?.rank||before.rank);return delta>0?`↑${delta}`:delta<0?`↓${-delta}`:'—';}
 const codeRows:Row[]=view==='favorites'?favorites.map(code=>({code,rank:0})):view==='search'?searched?[{code:searched,rank:0}]:[]:local;
 const rawProduct=(code:string)=>products[code]?.status==='found'?products[code]:report?.products[code]?.status==='found'?report.products[code]:products[code];
 const product=(code:string)=>{const p=rawProduct(code);if(view==='search'||view==='favorites')return p;const row=local.find(r=>r.code===code);return row&&validation(row,p).verified?p:p?{...p,name:undefined,image:undefined,price:undefined,normalPrice:undefined,url:searchLink(code)}:p;};
 function card(row:Row){return <ProductCard key={row.code} row={row} p={rawProduct(row.code)} other={undefined} scope={'우리 매장'} date={report?.date||''} favorite={favorites.includes(row.code)} onStar={()=>star(row.code)} onPhoto={()=>setModal(row.code)} onCopy={copy} onRefresh={()=>{void lookup(row.code,true);}}/>;}
 const hasFailedProducts=codeRows.some(r=>product(r.code)?.status==='error');
 const activeCode=study?favorites[studyIndex%Math.max(favorites.length,1)]:modal;const activeProduct=activeCode?product(activeCode):undefined;
 return <><header className="header"><div className="header-inner"><button className="wordmark" onClick={logoClick}>TOPTEN<span>DAILY</span><i/></button><nav className="desktop-nav">{[['today','오늘'],['reports','최근 리포트'],['favorites','즐겨찾기'],['closing','마감']].map(([key,label])=><button key={key} className={view===key?'active':''} onClick={()=>navigate(key)}>{label}</button>)}</nav><form className="search-form" onSubmit={directSearch}><Search size={18}/><input ref={searchInput} value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} placeholder="품번 검색" aria-label="품번 검색" maxLength={15}/><button aria-label="검색" type="submit"><ChevronRight size={18}/></button></form></div></header>
 <main>{view==='closing'?<Suspense fallback={<p role="status">마감 체크리스트를 불러오는 중…</p>}><ClosingChecklist/></Suspense>:<><div className="eyebrow">YOUR DAILY PRODUCT EDIT</div><div className="title-row"><div><h1>{view==='reports'?'최근 리포트':view==='favorites'?'기억해 둘 상품':view==='search'?'품번으로 바로 찾기':'우리 매장 TOP5'}</h1><p className="subtitle">{view==='today'?(dailyLoading&&!report?'오늘의 공유 TOP5를 불러오는 중…':report?report.date+(report.shared?' · 공유 TOP5':' · 이 기기 리포트'):'오늘 등록된 TOP5가 없습니다.'):view==='reports'?'이 기기에 저장한 판매 리포트':view==='favorites'?`즐겨찾기 ${favorites.length}개 · 출근 전 가볍게 익혀보세요.`:'리포트 없이도 공식몰 상품을 확인하세요.'}</p></div>{view==='today'&&report&&!report.shared&&<button className="primary" onClick={()=>input.current?.click()} disabled={busy||!hydrated}><Upload size={17}/>새 리포트</button>}{view==='favorites'&&favorites.length>0&&<button className="primary" onClick={()=>{setStudy(true);setAnswer(false);setStudyIndex(0);}}><BookOpen size={18}/>상품 익히기</button>}</div>
 <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={e=>upload(e.target.files?.[0])}/>
 {view==='today'&&sharedError&&<p className="closing-warning" role="status">{sharedError}<button onClick={()=>window.location.reload()}>다시 불러오기</button></p>}
 {error&&<div className="error" role="alert">{error}<button aria-label="알림 닫기" onClick={()=>setError('')}><X size={18}/></button></div>}
 {view==='today'&&!dailyLoading&&(!report||busy||draft)&&<section className="upload-section"><div className={'dropzone '+(drag?'drag':'')} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);upload(e.dataTransfer.files[0]);}}>{preview?<img className="report-preview" src={preview} alt="업로드한 판매 리포트 미리보기"/>:<div className="upload-icon"><ScanLine size={36} strokeWidth={1.25}/></div>}<div><span className="step-label">01 / DAILY REPORT</span><h2>{busy?'리포트를 읽고 있어요':report?'리포트 인식 완료':'판매 리포트 업로드'}</h2><p>{busy?progress:'사진을 올리면 품번과 판매수량만 바로 읽습니다.'}</p><button className="primary" disabled={busy||!hydrated} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>} {busy?'분석 중':'리포트 선택'}</button><button className="manual-entry" disabled={busy} onClick={()=>setEditor('manual')}>직접입력</button><small>JPG · PNG / 최대 25MB</small></div></div><div className="upload-note"><span><Check size={15}/>PaddleOCR로 정확하게 분석</span><span>우리 매장 TOP5 전용</span></div></section>}
 {view==='reports'&&<div className="history">{reports.map(r=><button key={r.id} onClick={()=>{setReport(r);setView('today');setTab('storeRanking');setFilter('all');}}><div className="history-icon"><Clock size={23}/></div><div><b>{r.date.replaceAll('-','.')}</b><p>{r.store}</p></div><span>TOP5 보기</span><ChevronRight size={20}/></button>)}{!reports.length&&<div className="empty"><Clock size={36}/><h2>아직 저장한 리포트가 없어요</h2><p>오늘의 판매 리포트를 올려보세요.</p><button className="primary" onClick={()=>navigate('today')}>리포트 올리기</button></div>}</div>}
 {view==='today'&&report&&!draft&&!busy&&!showProducts&&
 <section style={{maxWidth:900,margin:'18px auto',padding:'0 18px'}}>
  <div style={{border:'1px solid #e5e7eb',borderRadius:14,overflow:'hidden',background:'#fff'}}>
   <div style={{display:'grid',gridTemplateColumns:'80px 1fr 140px',gap:12,padding:'12px 18px',fontWeight:800,background:'#f8fafc',borderBottom:'1px solid #e5e7eb'}}>
    <span>순위</span><span>품번</span><span style={{textAlign:'center'}}>판매수량</span>
   </div>
   {report.storeRanking.slice(0,5).map((row,i)=>
    <div key={i} style={{display:'grid',gridTemplateColumns:'80px 1fr 140px',gap:12,alignItems:'center',padding:'14px 18px',borderBottom:i<4?'1px solid #eef0f2':'none'}}>
     <strong style={{fontSize:18}}>{row.rank||i+1}위</strong>
     <span style={{fontSize:20,fontWeight:700,letterSpacing:'.02em'}}>{row.code||'-'}</span>
     <span style={{fontSize:20,fontWeight:800,textAlign:'center'}}>{row.quantity??'-'}</span>
    </div>
   )}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}><button className="manual-entry" onClick={()=>setEditor('manual')}>직접입력</button>
   <button className="primary" onClick={()=>setShowProducts(true)}>
    상품 보기 <ChevronRight size={18}/>
   </button>
  </div>
 </section>}
 {view==='today'&&report&&!draft&&!busy&&showProducts&&<>
  <div className="report-toolbar">
   <button onClick={()=>setShowProducts(false)}>← TOP5</button>
   <button className="primary" onClick={()=>setBriefingOpen(true)}>전체 브리핑</button>
   <button disabled={refreshing} onClick={retryProducts}>{refreshing?'조회 중…':'상품정보 새로고침'}</button>
  </div>
  <div className="grid">{codeRows.map(card)}</div>
 </>}
 {view!=='today'&&view!=='reports'&&!draft&&!busy&&<div className="grid">{codeRows.map(card)}</div>}
 {hasFailedProducts&&!busy&&!draft&&<div className="retry-banner" role="status"><span>일부 상품을 불러오지 못했어요.</span><button disabled={refreshing} onClick={retryProducts}>{refreshing?'다시 불러오는 중…':'다시 불러오기'}</button></div>}
 {view==='search'&&!searched&&<div className="empty"><Search size={38}/><h2>지금 궁금한 상품이 있나요?</h2><p>상단 검색창에 상품 태그의 품번을 입력하세요.</p></div>}{searching&&<p role="status" className="muted">공식몰에서 상품을 찾고 있어요…</p>}
 {view==='favorites'&&!favorites.length&&<div className="empty"><Star size={38}/><h2>기억해 두고 싶은 상품을 모아보세요</h2><p>상품 카드의 별을 누르면 여기에 저장됩니다.</p></div>}

 </>}<footer><b>TOPTEN DAILY</b><small>오늘 TOP5는 공유 · 즐겨찾기·마감은 기기별 저장</small></footer></main>
 <nav className="mobile-nav">{[['today','오늘',Home],['reports','리포트',Clock],['search','검색',Search],['favorites','즐겨찾기',Star],['closing','마감',ClipboardCheck]].map(([key,label,Icon]:any)=><button key={key} className={view===key?'active':''} onClick={()=>navigate(key)}><Icon size={21}/>{label}</button>)}</nav>
 <dialog ref={dialog} className="product-dialog" onCancel={()=>{setModal(null);setStudy(false);}} onClick={e=>{if(e.target===e.currentTarget){setModal(null);setStudy(false);}}}><button className="dialog-close" aria-label="닫기" onClick={()=>{setModal(null);setStudy(false);}}><X/></button>{activeCode&&<><div className="dialog-image">{activeProduct?.image?<img decoding="async" referrerPolicy="no-referrer" src={activeProduct.image} alt={study&&!answer?'품번을 떠올려 보세요':activeProduct.name}/>:<ImageIcon size={70}/>}</div><div className="dialog-body">{study?<><span className="step-label">상품 익히기 · {studyIndex%favorites.length+1}/{favorites.length}</span><h2>이 상품의 품번은?</h2>{answer?<><h3>{activeCode}</h3><p>{activeProduct?.name||'상품정보 '}</p><button className="primary" onClick={()=>{setStudyIndex(x=>x+1);setAnswer(false);}}>다음 상품</button></>:<button className="primary" onClick={()=>setAnswer(true)}>정답 보기</button>}</>:<><span className="step-label">TOPTEN OFFICIAL</span><h2>{activeProduct?.name||'상품정보 '}</h2><button className="code" onClick={()=>copy(activeCode)}>{activeCode}<Copy size={15}/></button><p className="price">{activeProduct?.price?.toLocaleString()}{activeProduct?.price!==undefined?'원':''}</p><a className="primary" href={activeProduct?.url||searchLink(activeCode)} target="_blank" rel="noreferrer">공식몰에서 보기 <ArrowUpRight size={17}/></a><h3>최근 TOP5 등장</h3><div className="appearances">{reports.filter(r=>(!report||r.store===report.store)&&r.storeRanking.slice(0,5).some(s=>s.code===activeCode)).slice(0,10).map(r=><p key={r.id}><span>{r.date.slice(5).replace('-','/')} · {r.store}</span><b>#{r.storeRanking.find(s=>s.code===activeCode)?.rank}</b></p>)}{!reports.some(r=>(!report||r.store===report.store)&&r.storeRanking.slice(0,5).some(s=>s.code===activeCode))&&<p>저장된 우리 매장 순위가 없습니다.</p>}</div></>}</div></>}</dialog>
 {briefingOpen&&report&&<Suspense fallback={<p role="status">브리핑 준비 중…</p>}><BriefingDialog rows={local} products={{...report.products,...products}} date={report.date} scope={'우리 매장'} onClose={()=>setBriefingOpen(false)} onCopy={copy}/></Suspense>}
 {editor&&<Suspense fallback={<p role="status">입력창을 여는 중…</p>}><DailyEditor mode={editor} initial={report?.date===today()?report:null} onClose={()=>setEditor(null)} onSave={saveEditor}/></Suspense>}{toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}</>;
}



