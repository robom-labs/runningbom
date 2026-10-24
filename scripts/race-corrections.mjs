// Reviewed, exact-edition conservative overrides; never manufacture clickable links or freshness.
const allowed=new Set(['status','registrationDataStatus','registrationDataIssue','note']);
const removable=new Set(['registrationCloseAt','registrationCloseTimeConfirmed']);
const jinju={id:'schedule-221be78438dc',name:'제36회 진주마라톤',date:'2026-12-13'};
const jinjuPatch={venue:'진주노을공원(남강댐 물 문화관)',registrationOpenAt:'2026-09-14T10:00:00+09:00',registrationOpenTimeConfirmed:true,registrationPeriodLabel:'09/14 ~ 선착순 마감',status:'closed'};
// These are the reviewed primary response bodies, not directory claims or a new freshness stamp.
const jinjuProof=[
 {sourceUrl:'https://www.jinma.co.kr/ko/sub1_2.html',sha256:'a57fd7cdfaea28db8eaf1b149897afd41ea27ea1d539d4859f22ab87499aed23',checkedAt:'2026-10-24T01:15:40.905Z'},
 {sourceUrl:'https://www.jinma.co.kr/ko/sub2_1.html',sha256:'0c9cf2a57e595388a8a4b2dd407b1cf38ab05c3f8616576ecc45b35ebe99290c',checkedAt:'2026-10-24T01:15:41.186Z'},
 {sourceUrl:'https://www.jinma.co.kr/ko/sub2_3.html',sha256:'4e6026cf5f5c9cd06ca1b26aa5e032e626f44ab384c5e0bd7775d8d1832dbc66',checkedAt:'2026-10-24T01:16:26.908Z'},
];
const nativeFields={status:'registrationStatus',registrationOpenAt:'registrationOpensAt',registrationOpenTimeConfirmed:'registrationTimeConfirmed',registrationCloseAt:'registrationClosesAt',registrationCloseTimeConfirmed:'registrationClosingTimeConfirmed'};
const rows=data=>[...(data.featuredRaces||[]),...(data.scheduleFeed||[])];
const isJinju=correction=>Object.entries(jinju).every(([key,value])=>correction[key]===value);
// Raw directory rows may not yet have a stable ID; preserve that shape. If an ID exists it must match.
const matches=(row,correction)=>row.name===correction.name&&String(row.date??row.raceDate).slice(0,10)===correction.date&&(!isJinju(correction)||row.id===undefined||row.id===correction.id);
const validDate=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function validate(corrections){
 if(!Array.isArray(corrections?.entries))throw Error('correction registry invalid');
 const seen=new Set();
 for(const correction of corrections.entries){
  const key=correction.name+'|'+correction.date;
  if(seen.has(key)||typeof correction.name!=='string'||!correction.name.trim()||!validDate(correction.date))throw Error('duplicate/invalid correction edition');
  seen.add(key);
  const source=new URL(correction.sourceUrl);
  if(!['http:','https:'].includes(source.protocol)||source.username||source.password)throw Error('invalid evidence URL');
  if(!correction.patch||typeof correction.patch!=='object'||Array.isArray(correction.patch))throw Error('unreviewed correction field/status');
  if(isJinju(correction)){
   if(Object.keys(correction.patch).length!==Object.keys(jinjuPatch).length||Object.entries(correction.patch).some(([key,value])=>!Object.hasOwn(jinjuPatch,key)||value!==jinjuPatch[key]))throw Error('unreviewed Jinju correction field/status');
   const closure=jinjuProof[2];
   if(correction.sourceUrl!==closure.sourceUrl||correction.sourceSha256!==closure.sha256||correction.checkedAt!==closure.checkedAt)throw Error('reviewed Jinju primary proof required');
   if(!Array.isArray(correction.primaryProof)||correction.primaryProof.length!==jinjuProof.length||jinjuProof.some(expected=>!correction.primaryProof.some(proof=>Object.entries(expected).every(([key,value])=>proof[key]===value))))throw Error('reviewed Jinju primary proof required');
   if(!Array.isArray(correction.removeFields)||correction.removeFields.length!==removable.size||new Set(correction.removeFields).size!==removable.size||correction.removeFields.some(key=>!removable.has(key)))throw Error('unreviewed correction removeFields');
  }else{
   if(Object.keys(correction.patch).some(key=>!allowed.has(key))||!['cancelled','unknown'].includes(correction.patch.status))throw Error('unreviewed correction field/status');
   if(Object.entries(correction.patch).some(([key,value])=>key!=='status'&&(typeof value!=='string'||!value.trim()||value.length>3000)))throw Error('invalid correction value');
   if(correction.removeFields!==undefined)throw Error('unreviewed correction removeFields');
  }
 }
}
export function applyVerifiedRaceCorrections(data,corrections){
 validate(corrections);let changed=false;
 for(const row of rows(data)){
  const correction=corrections.entries.find(c=>matches(row,c));if(!correction)continue;
  for(const [key,value]of Object.entries(correction.patch))if(row[key]!==value){row[key]=value;changed=true;}
  for(const key of correction.removeFields||[])if(Object.hasOwn(row,key)){delete row[key];changed=true;}
  if(row.officialCorrectionSource!==correction.sourceUrl){row.officialCorrectionSource=correction.sourceUrl;changed=true;}
 }
 return changed;
}
export function correctionProblems(data,corrections,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())){
 validate(corrections);const problems=[];
 for(const correction of corrections.entries){
  const matching=rows(data).filter(row=>matches(row,correction));
  if(correction.date>=today&&matching.length!==1)problems.push({name:correction.name,date:correction.date,code:'missing-or-duplicate-protected-edition'});
  for(const row of matching)if(Object.entries(correction.patch).some(([key,value])=>row[key]!==value)||(correction.removeFields||[]).some(key=>Object.hasOwn(row,key))||row.officialCorrectionSource!==correction.sourceUrl)problems.push({name:correction.name,date:correction.date,code:'protected-correction-not-applied'});
 }
 return problems;
}
export function nativeCorrectionProblems(records,corrections,today){
 validate(corrections);const problems=[];
 for(const correction of corrections.entries){
  const matching=records.filter(row=>row.raceDate===correction.date&&matches(row,correction)&&(!isJinju(correction)||row.id===correction.id));
  if(correction.date>=today&&matching.length!==1)problems.push({name:correction.name,code:'missing-or-duplicate-protected-native-edition'});
  for(const row of matching)if(Object.entries(correction.patch).some(([key,value])=>row[nativeFields[key]||key]!==value)||(correction.removeFields||[]).some(key=>row[nativeFields[key]||key]!==undefined))problems.push({name:correction.name,code:'protected-native-correction-not-applied'});
 }
 return problems;
}
