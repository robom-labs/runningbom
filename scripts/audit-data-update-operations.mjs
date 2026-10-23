// Read-only end-to-end evidence. No workflow dispatch, git writes or deployment.
import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {workflowHeartbeat} from './workflow-heartbeat-core.mjs';
import {verifyCoursePair} from './course-data-publication.mjs';
import {verifyInterestPair} from './shoe-interest-publication.mjs';
const REPO='robom-labs/runningbom',BASE='https://robom-labs.github.io/runningbom/';
const hash=text=>createHash('sha256').update(text).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function assessCatalogPublicPair(text,manifest,now=Date.now()){
  const d=JSON.parse(text),ps=d.products??[];
  const valid=d.schemaVersion===1&&manifest.schemaVersion===1&&d.revision===manifest.revision&&d.generatedAt===manifest.generatedAt&&ps.length>0&&manifest.count===ps.length&&manifest.sha256===hash(text)&&new Set(ps.map(p=>p.id)).size===ps.length;
  if(!valid)throw Error('Catalog public schema/checksum/identity invalid');
  const ageHours=(now-Date.parse(d.generatedAt))/3600000;if(!Number.isFinite(ageHours)||ageHours< -5/60||ageHours>30)throw Error('Catalog public snapshot stale');
  const stale=ps.filter(p=>!Number.isFinite(Date.parse(p.checkedAt))||now-Date.parse(p.checkedAt)>30*86400000);
  const staleByBrand={};for(const p of stale)staleByBrand[p.brand]=(staleByBrand[p.brand]??0)+1;
  return {revision:d.revision,count:ps.length,ageHours,staleProducts:stale.length,staleByBrand,allProductsFresh:stale.length===0};
}
export function assessRunHistory(runs,now=Date.now(),maxHours=10){
  const list=Array.isArray(runs)?runs:[],latest=list[0],completed=list.find(r=>r.status==='completed');
  const ageHours=(now-Date.parse(completed?.updated_at))/3600000;
  const normalized=list.map(r=>({status:r.status,conclusion:r.conclusion,updatedAt:r.updated_at}));
  const base=maxHours===10?workflowHeartbeat(normalized,now):{ok:!!completed&&completed.conclusion==='success'&&ageHours>=-5/60&&ageHours<=maxHours&&(!latest||latest.status==='completed')};
  return {...base,latestStatus:latest?.status??null,latestConclusion:latest?.conclusion??null,runUrl:latest?.html_url??null,lastCompletedUrl:completed?.html_url??null,lastSuccessAt:list.find(r=>r.status==='completed'&&r.conclusion==='success')?.updated_at??null};
}
export async function boundedRead(url,{fetcher=fetch,method='GET',attempts=2,maxBytes=4_000_000,timeoutMs=12000}={}){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS required');
  for(let n=0;n<attempts;n++){
    try{
      const r=await fetcher(u,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
      if(!r.ok){await r.body?.cancel();if(r.status>=500&&n+1<attempts){await sleep(500);continue;}throw Object.assign(Error(`HTTP ${r.status}`),{permanent:true});}
      if(method==='HEAD'){await r.body?.cancel();return {status:r.status,text:'',url:u.href};}
      let count=0,parts=[];for await(const x of r.body){count+=x.byteLength;if(count>maxBytes)throw Object.assign(Error('Response size bound exceeded'),{permanent:true});parts.push(Buffer.from(x));}
      return {status:r.status,text:Buffer.concat(parts).toString('utf8'),url:u.href};
    }catch(e){if(e.permanent||n+1===attempts)throw e;await sleep(500);}
  }
}
function github(path){return JSON.parse(execFileSync('gh',['api',`repos/${REPO}/${path}`],{encoding:'utf8',timeout:20000,maxBuffer:4_000_000,stdio:['ignore','pipe','pipe']}));}
function mainText(path){const r=github(`contents/${path}?ref=main`);if(!r.content||r.encoding!=='base64')throw Error('GitHub contents unavailable');return Buffer.from(r.content,'base64').toString('utf8');}

export async function auditDataUpdates({now=Date.now(),read=boundedRead,gh=github,source=mainText}={}){
  const report={checkedAt:new Date(now).toISOString(),repository:REPO,readOnly:true,checks:[],limits:{timeoutMs:12000,maxAttempts:2,publicReadMaxBytes:4_000_000},claims:{device:false,allNetworks:false,liveMapSearchResults:false,futureServiceGuarantee:false}};
  const check=async(name,fn)=>{try{const result=await fn();report.checks.push({name,ok:true,...result});}catch(e){report.checks.push({name,ok:false,error:e.message.replace(/gh[pousr]_[A-Za-z0-9_]+/g,'[redacted]').slice(0,220)});}};
  const get=async path=>(await read(BASE+path+'?ops-audit='+now)).text;
  await check('race-public-main-byte-match',async()=>{
    const text=await get('races.json'),d=JSON.parse(text);if(!Array.isArray(d.featuredRaces)||!Array.isArray(d.scheduleFeed)||hash(text)!==hash(source('outputs/pushrun-site/races.json')))throw Error('Public race schema/main mismatch');
    const ageHours=(now-Date.parse(d.lastSuccessfulRefreshAt))/3600000;if(!Number.isFinite(ageHours)||ageHours< -5/60||ageHours>30)throw Error('Race observation stale');return {version:d.version,count:d.featuredRaces.length+d.scheduleFeed.length,ageHours};
  });
  await check('native-static-public-envelope',async()=>{
    const manifest=JSON.parse(await get('data/manifest.json'));if(manifest.schemaVersion!==1||!manifest.checksums||!manifest.sizes||!manifest.recordCounts)throw Error('Static manifest schema');
    const files=[];for(const name of ['races.json','shoes.json','upcoming-shoes.json','coaching.json']){
      const text=await get('data/'+name),d=JSON.parse(text);if(hash(text)!==manifest.checksums[name]||Buffer.byteLength(text)!==manifest.sizes[name]||d.schemaVersion!==1||!Array.isArray(d.records)||d.records.length!==manifest.recordCounts[name])throw Error('Static payload checksum/schema/count mismatch: '+name);
      files.push({name,count:d.records.length,generatedAt:d.generatedAt});
    }return {contentVersion:manifest.contentVersion,generatedAt:manifest.generatedAt,files};
  });
  await check('catalog-public-main-pair',async()=>{
    const text=await get('data/verified-products.json'),manifest=JSON.parse(await get('data/verified-products.manifest.json')),r=assessCatalogPublicPair(text,manifest,now);if(hash(text)!==hash(source('data/verified-products.json')))throw Error('Public catalog differs from main');return {...r,ok:r.allProductsFresh};
  });
  await check('interest-public-main-pair',async()=>{
    const text=await get('data/catalog/shoe-interest.json'),manifest=JSON.parse(await get('data/catalog/shoe-interest.manifest.json'));
    const products=JSON.parse(await get('data/verified-products.json')).products;
    const result=verifyInterestPair(text,manifest,{now,products});
    if(hash(text)!==hash(source('data/shoe-interest.json')))throw Error('Public interest differs from main');
    return {...result,complete:true,actualPublicPairVerified:true};
  });
  await check('course-public-pair',async()=>{const text=await get('data/course-catalog.json'),manifest=JSON.parse(await get('data/course-catalog.manifest.json'));return verifyCoursePair(text,manifest,{now});});
  for(const [kind,file,maxHours] of [['races','refresh-race-data.yml',10],['catalog','refresh-verified-catalog.yml',10],['interest','refresh-shoe-interest.yml',30],['courses','refresh-course-catalog.yml',192]])await check(kind+'-completed-success-heartbeat',async()=>{
    const runs=gh(`actions/workflows/${file}/runs?branch=main&per_page=5`).workflow_runs;
    const heartbeat=assessRunHistory(runs,now,maxHours),last=runs?.[0];
    if(kind==='catalog'&&last?.status==='completed'&&last.conclusion==='failure'){
      const jobs=gh(`actions/runs/${last.id}/jobs`).jobs;
      heartbeat.failedSteps=jobs.flatMap(j=>j.steps.filter(s=>s.conclusion==='failure').map(s=>s.name));
      heartbeat.publicationSteps=jobs.flatMap(j=>j.steps.filter(s=>/public pair|overlay existing gh-pages/.test(s.name)).map(s=>({name:s.name,conclusion:s.conclusion})));
      heartbeat.partialPublicationIsNotAllSourcesSuccess=true;
    }
    return heartbeat;
  });
  report.ok=report.checks.every(c=>c.ok);return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2);if(args.some(a=>a!=='--report'))throw Error('Only --report is supported (fixed docs report path)');
  const report=await auditDataUpdates();if(args.includes('--report'))await writeFile(new URL('../docs/data-update-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}
