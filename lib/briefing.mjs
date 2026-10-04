export function dateWord(date,now=new Date()){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 return date===today?'금일':date===yesterday?'전일':/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:'';
}
export function briefing(row,product,notes,date,scope='우리 매장',now=new Date()){
 const sentences=[];sentences.push(product?.name?`이 상품은 ${product.name}입니다.`:`품번 ${row.code} 상품입니다.`);
 if(product?.price!=null)sentences.push(`현재 판매가는 ${Number(product.price).toLocaleString('ko-KR')}원입니다.`);
 const facts=[];if(row.rank>0)facts.push(`${dateWord(date,now)} ${scope} 판매 ${row.rank}위` .trim());if(scope==='우리 매장'&&row.quantity!=null)facts.push(`${row.quantity}PCS 판매`);if(scope==='우리 매장'&&row.amount!=null)facts.push(`판매금액 ${Number(row.amount).toLocaleString('ko-KR')}원`);if(facts.length)sentences.push(`${facts.join(', ')}입니다.`);
 if(notes?.location||notes?.display)sentences.push([notes.location?`매장 위치는 ${notes.location}`:'',notes.display?`진열·적재 방식은 ${notes.display}`:''].filter(Boolean).join(', ')+'입니다.');
 return sentences.join(' ');
}
