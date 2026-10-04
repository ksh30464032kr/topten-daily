export function achievement(sales:string,target:string){return sales!==''&&Number(target)>0?Number(sales)/Number(target)*100:null;}
export function closingMessage(transfer:number|null,status:string,issue:string,rate:number|null,includeRate:boolean){
 if(transfer===null||!Number.isSafeInteger(transfer)||transfer<0||!status||(status==='issue'&&!issue.trim()))return '';
 return [status==='ok'?'마감 이상 없습니다.':`마감 특이사항: ${issue.trim()}`,`명일 이체금액 ${transfer.toLocaleString('ko-KR')}원입니다.`,includeRate&&rate!==null?`오늘 달성률 ${rate.toFixed(1)}%입니다.`:''].filter(Boolean).join('\n');
}
