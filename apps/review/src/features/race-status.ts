type Registration={registrationStatus?:string;registrationOpensAt?:string|null;registrationClosesAt?:string|null;registrationTimeConfirmed?:boolean;needsReview?:boolean};
export const registrationRank=(status:string)=>({마감임박:0,접수중:0,예정:1,접수마감:2,'확인 필요':3}[status]??3);
export function raceFocus(r:{opensAt:string;closesAt:string;raceAt:string;status:string;timeConfirmed:boolean},axis:string){
 if(axis!=='접수 일정'||r.status==='접수마감'||r.status==='확인 필요')return {label:'대회 개최',date:r.raceAt,hint:r.status};
 if(r.status==='접수중'||r.status==='마감임박')return r.closesAt?{label:'접수 마감',date:r.closesAt,hint:r.status}:{label:'대회 개최',date:r.raceAt,hint:r.status};
 return {label:'접수 시작',date:r.opensAt,hint:r.timeConfirmed?'시각 확인':'시각 미공개'};
}
export function registrationState(r:Registration,now=new Date()):'확인 필요'|'예정'|'접수중'|'마감임박'|'접수마감'{
 if(r.needsReview)return '확인 필요';
 if(r.registrationStatus==='closed')return '접수마감';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now);
 const closes=r.registrationClosesAt;
 if(closes){
  const ended=r.registrationTimeConfirmed?Date.parse(closes)<now.getTime():closes.slice(0,10)<today;
  if(ended)return '접수마감';
 }
 const opens=r.registrationOpensAt;
 if(opens&&(r.registrationTimeConfirmed?Date.parse(opens)>now.getTime():opens.slice(0,10)>today))return '예정';
 if(r.registrationStatus==='open'){
  const days=closes?(Date.parse(closes.slice(0,10)+'T23:59:59+09:00')-now.getTime())/86400000:Infinity;
  return days>=0&&days<=3?'마감임박':'접수중';
 }
 return r.registrationStatus==='scheduled'?'예정':'확인 필요';
}
