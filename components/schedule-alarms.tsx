'use client';
import {useEffect,useState} from 'react';
import {alarmRows,alarmIntent} from '../lib/schedule-alarms.mjs';
import {today} from '../lib/daily';
export default function ScheduleAlarms({date,person}:{date:string;person:{off:boolean;start:string;breaks:{start:string;end:string}[]}}){
 const [android,setAndroid]=useState(false),[message,setMessage]=useState(''),[now,setNow]=useState(0);
 useEffect(()=>{setAndroid(/Android/i.test(navigator.userAgent));setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(id);},[]);
 const rows=alarmRows(date,person);
 if(!rows.length)return null;
 return <details className="schedule-alarms"><summary>알람 시간 · 갤럭시 연결</summary><p>출근 2분 전, 휴게 시작 1분 전입니다. 시계 앱 연결은 실험 기능이며 기기·브라우저에 따라 열리지 않을 수 있습니다.</p>{rows.map((row:{label:string;time:string;at:number},i:number)=><div key={i}><span>{row.label} <b>{row.time}</b></span>{android&&date===today()&&row.at>now&&<a className="manual-entry" href={alarmIntent(row)} onClick={e=>{if(row.at<=Date.now()||date!==today()){e.preventDefault();setMessage('지난 시간은 등록할 수 없습니다.');return;}setMessage('등록 여부는 시계 앱에서 확인하세요. 열리지 않으면 시간 복사를 사용해 주세요.');}}>시계 앱 연결 시도</a>}<button className="manual-entry" onClick={async()=>{try{await navigator.clipboard.writeText(`${date} ${row.time} TOPTEN ${row.label}`);setMessage('알람 시간을 복사했습니다.');}catch{setMessage(`시계 앱에서 ${row.time}을 직접 입력해 주세요.`);}}}>시간 복사</button></div>)}<p>무음·진동을 요청합니다. 시계 앱에서 소리 끄기·진동 켜기·반복 없음을 확인해 주세요. 등록·삭제 여부는 이 사이트에서 확인하거나 관리할 수 없습니다.</p>{(!android||date!==today())&&<p>시계 앱 연결 버튼은 갤럭시 등 Android에서 오늘의 아직 지나지 않은 시간에 표시됩니다.</p>}{message&&<p role="status">{message}</p>}</details>;
}
