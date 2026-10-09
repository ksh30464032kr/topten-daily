export function parseDailyPaste(text, expectedDate) {
 const lines=text.trim().replace(/^```[^\n]*\n?|\n?```$/g,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines.length!==8)throw Error('날짜·목표금액·TOP5 제목과 순위 5줄 형식으로 붙여넣어 주세요.');
 const date=lines[0].match(/^날짜\s*[:：]\s*(\d{4}-\d{2}-\d{2})$/)?.[1];
 if(date!==expectedDate)throw Error('오늘 날짜('+expectedDate+')의 결과만 등록할 수 있습니다. 날짜를 확인해 주세요.');
 const amountText=lines[1].match(/^목표금액\s*[:：]\s*(.+)$/)?.[1];
 if(!amountText||!/^TOP\s*5\s*[:：]?$/i.test(lines[2]))throw Error('목표금액과 TOP5 제목을 확인해 주세요.');
 let target='';
 if(amountText!=='확인 필요'){
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)\s*원?$/.test(amountText))throw Error('목표금액은 원 단위 숫자 또는 확인 필요로 입력하세요.');
  const amount=Number(amountText.replace(/[,원\s]/g,''));
  if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000000)throw Error('목표금액을 확인해 주세요.');
  target=String(amount/10000);
 }
 const rows=lines.slice(3).map((line,i)=>{
  const match=line.match(/^(\d)[.)]\s*(확인 필요|M[SK][A-Z]\d[A-Z]{2}\d{4})\s*,\s*(확인 필요|\d{1,5})$/i);
  if(!match||Number(match[1])!==i+1)throw Error((i+1)+'번째 줄을 확인하세요. 예: '+(i+1)+'. MSG4JP2402, 12');
  return {code:match[2]==='확인 필요'?'':match[2].toUpperCase(),quantity:match[3]==='확인 필요'?'':match[3]};
 });
 const codes=rows.map(r=>r.code).filter(Boolean);
 if(new Set(codes).size!==codes.length)throw Error('같은 품번이 중복됐습니다. 원본을 확인해 주세요.');
 return {rows,target};
}
export const dailyPasteTemplate=date=>`날짜: ${date}\n목표금액: 확인 필요\nTOP5:\n1. 확인 필요, 확인 필요\n2. 확인 필요, 확인 필요\n3. 확인 필요, 확인 필요\n4. 확인 필요, 확인 필요\n5. 확인 필요, 확인 필요`;
