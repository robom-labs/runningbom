// Reviewed, exact-edition conservative overrides; never manufacture clickable links or freshness.
const allowed=new Set(['status','registrationDataStatus','registrationDataIssue','note']);
const rows=data=>[...(data.featuredRaces||[]),...(data.scheduleFeed||[])];
const matches=(row,correction)=>row.name===correction.name&&String(row.date??row.raceDate).slice(0,10)===correction.date;
function validate(corrections){
 if(!Array.isArray(corrections?.entries))throw Error('correction registry invalid');
 const seen=new Set();
 for(const correction of corrections.entries){
  const key=correction.name+'|'+correction.date;
  if(seen.has(key)||!correction.name||!/^20\d{2}-\d{2}-\d{2}$/.test(correction.date))throw Error('duplicate/invalid correction edition');
  seen.add(key);
  const source=new URL(correction.sourceUrl);
  if(!['http:','https:'].includes(source.protocol)||source.username||source.password)throw Error('invalid evidence URL');
  if(!correction.patch||Object.keys(correction.patch).some(key=>!allowed.has(key))||!['cancelled','unknown'].includes(correction.patch.status))throw Error('unreviewed correction field/status');
 }
}
export function applyVerifiedRaceCorrections(data,corrections){
 validate(corrections);let changed=false;
 for(const row of rows(data)){
  const correction=corrections.entries.find(c=>matches(row,c));if(!correction)continue;
  for(const [key,value]of Object.entries(correction.patch))if(row[key]!==value){row[key]=value;changed=true;}
  if(row.officialCorrectionSource!==correction.sourceUrl){row.officialCorrectionSource=correction.sourceUrl;changed=true;}
 }
 return changed;
}
export function correctionProblems(data,corrections,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())){
 validate(corrections);const problems=[];
 for(const correction of corrections.entries){
  const matching=rows(data).filter(row=>matches(row,correction));
  if(correction.date>=today&&matching.length!==1)problems.push({name:correction.name,date:correction.date,code:'missing-or-duplicate-protected-edition'});
  for(const row of matching)if(Object.entries(correction.patch).some(([key,value])=>row[key]!==value)||row.officialCorrectionSource!==correction.sourceUrl)problems.push({name:correction.name,date:correction.date,code:'protected-correction-not-applied'});
 }
 return problems;
}
export function nativeCorrectionProblems(records,corrections,today){
 validate(corrections);const problems=[];
 for(const correction of corrections.entries){
  const matching=records.filter(row=>row.name===correction.name&&row.raceDate===correction.date);
  if(correction.date>=today&&matching.length!==1)problems.push({name:correction.name,code:'missing-or-duplicate-protected-native-edition'});
  for(const row of matching)if(Object.entries(correction.patch).some(([key,value])=>row[key==='status'?'registrationStatus':key]!==value))problems.push({name:correction.name,code:'protected-native-correction-not-applied'});
 }
 return problems;
}
