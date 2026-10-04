export function alarmRows(date, person) {
 if (!person || person.off) return [];
 const values=[{label:'출근 2분 전',time:person.start,offset:2},...person.breaks.map((p,i)=>({label:`휴게 ${i+1} 시작 1분 전`,time:p.start,offset:1}))];
 return values.filter(v=>/^\d{2}:\d{2}$/.test(v.time)).map(v=>{
  const at=new Date(`${date}T${v.time}:00+09:00`).getTime()-v.offset*60000;
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(at);
  return {label:v.label,time,at};
 });
}
export function alarmIntent(row) {
 const [hour,minute]=row.time.split(':').map(Number);
 return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent('TOPTEN '+row.label)};S.android.intent.extra.alarm.RINGTONE=silent;B.android.intent.extra.alarm.VIBRATE=true;B.android.intent.extra.alarm.SKIP_UI=false;end`;
}
