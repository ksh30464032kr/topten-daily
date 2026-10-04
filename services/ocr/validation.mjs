// Supplied TOPTEN code dictionary. Legacy codes remain valid; never rewrite seasons.
export const categories={CG:'싱글코트',CB:'더블코트',KG:'싱글재킷',KB:'더블재킷',KS:'홑겹재킷',KP:'패딩재킷',VP:'패딩 베스트',LK:'가죽재킷',LJ:'가죽점퍼',WC:'캐주얼 셔츠',WD:'드레스 셔츠',TC:'카디건',TR:'라운드 티',TV:'V넥 티',TT:'칼라 티',TL:'민소매',TH:'후드',TS:'베스트',EC:'카디건',ER:'라운드 스웨터',EV:'V넥 스웨터',ET:'칼라 스웨터',ES:'베스트',OO:'원피스',PP:'팬츠',PH:'반바지',PT:'니트 긴바지',PS:'니트 반바지',DP:'데님 팬츠',DH:'데님 반바지',RL:'긴 스커트',RS:'짧은 스커트',US:'언더웨어 상의',UT:'언더웨어 하의/구 상의',UB:'브라',UP:'팬티/구 하의',UL:'라운지 상의',UG:'라운지 긴바지',UH:'라운지 반바지',UI:'라운지 세트',AB:'가방',AL:'벨트',AC:'모자',AS:'신발',AT:'타이',AM:'머플러',AV:'장갑',AY:'양말'};
export const legacy=['EL','DS','JJ','JP','WB','LV','AF','AP','AJ','AZ'];
export const changes={JP:['KP'],KP:['JP'],UT:['US','UP'],US:['UT'],UP:['UT']};
export function inspectCode(code){const category=code.slice(4,6),format=/^M[SK][A-Z][0-9][A-Z]{2}[0-9]{4}$/.test(code);return {format,category,known:!!categories[category]||legacy.includes(category),legacy:legacy.includes(category),label:categories[category]||(legacy.includes(category)?'구 품번 체계':'체계 미확인')};}
export function candidates(code,history=[]){
 const swaps={O:['0'],0:['O'],I:['1'],L:['1'],1:['I','L'],S:['5'],5:['S'],B:['8'],8:['B'],G:['6'],6:['G'],Z:['2'],2:['Z']};
 const out=new Set(history);for(let i=0;i<code.length;i++)for(const to of swaps[code[i]]||[])out.add(code.slice(0,i)+to+code.slice(i+1));
 if(code.length===11)for(let i=0;i<code.length;i++)out.add(code.slice(0,i)+code.slice(i+1));
 for(const cat of changes[code.slice(4,6)]||[])out.add(code.slice(0,4)+cat+code.slice(6));
 if(!inspectCode(code).known)for(const cat of Object.keys(categories).filter(c=>c[0]===code[4]))out.add(code.slice(0,4)+cat+code.slice(6));
 out.delete(code);return [...out].filter(c=>{const v=inspectCode(c);return v.format&&v.known;}).slice(0,8);
}
export function consensus(readings){const groups=new Map();for(const r of readings){const g=groups.get(r.code)||[];g.push(r);groups.set(r.code,g);}const sorted=[...groups].sort((a,b)=>b[1].length-a[1].length||Math.max(...b[1].map(r=>r.confidence))-Math.max(...a[1].map(r=>r.confidence)));const [code,votes]=sorted[0]||['',[]];return {code,confidence:votes.length?Math.min(...votes.map(r=>r.confidence)):0,agreement:votes.length,disagreement:groups.size>1,readings};}
// Category matching is deliberately conservative. An unknown product name needs human review.
export function categoryMatches(code,name=''){
 const c=code.slice(4,6);const patterns={C:/코트|coat/i,K:/재킷|자켓|패딩|jacket/i,V:/베스트|조끼|vest/i,L:/레더|가죽|leather/i,W:/셔츠|shirt/i,T:/티셔츠|티셔|맨투맨|스웨트|후드|베스트|조끼|카디건|가디건|티\b|tee|shirt|vest|cardigan/i,E:/스웨터|니트|가디건|카디건|베스트|조끼|sweater|knit|cardigan|vest/i,O:/원피스|드레스|dress/i,P:/팬츠|바지|슬랙스|레깅스|조거|pants|shorts/i,D:/데님|청바지|청쇼츠|denim|jeans/i,R:/스커트|치마|skirt/i,U:/언더|이너|내의|브라|팬티|파자마|라운지|잠옷|드로즈|런닝|트렁크|에어리즘|온에어/i,A:/가방|백팩|벨트|모자|캡|슈즈|신발|타이|머플러|장갑|양말|삭스/i};
 if(c==='JP'||c==='JJ')return /점퍼|패딩|재킷|자켓|파카|parka|jumper|jacket/i.test(name);if(legacy.includes(c))return false;return !!patterns[c[0]]?.test(name);
}
export function validation(row,product){const v=inspectCode(row.code);const reasons=[];if(!v.format)reasons.push('품번 형식');if(!v.known)reasons.push('복종코드');if(!row.approved&&(!(row.agreement>=2)||row.confidence<70||row.disagreement))reasons.push('OCR 결과 비교');if(product?.status!=='found'||product?.stale)reasons.push('공식몰 재확인');else if(!categoryMatches(row.code,product.name))reasons.push('상품명·복종 대조');return {verified:reasons.length===0,reasons,category:v.label};}
