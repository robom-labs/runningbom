// Follow the official links that the source actually publishes. No guessed hosts.
import {CheerioCrawler,Configuration} from '@crawlee/cheerio';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {organizerLinks,publicSourceUrl,isOrganizerPage} from './race-image-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const races=JSON.parse(await readFile(join(root,'apps/mobile/src/data/races.json'),'utf8')).races;
const file=join(root,'data/race-official-sources.json');let saved={schemaVersion:1,entries:{}};
try{saved=JSON.parse(await readFile(file,'utf8'));}catch{}
const failures=[],today=new Date().toISOString();
const crawler=new CheerioCrawler({maxConcurrency:3,maxRequestsPerMinute:60,maxRequestRetries:1,maxRequestsPerCrawl:130,navigationTimeoutSecs:15,respectRobotsTxtFile:true,useSessionPool:false,retryOnBlocked:false,
 async requestHandler({request,$}){
  const race=races.find(x=>x.id===request.userData.id),page=request.loadedUrl||request.url;
  const urls=organizerLinks($.html(),page);if(!race||!urls.length)return;
  saved.entries[race.id]={urls:[...new Set([...(saved.entries[race.id]?.urls||[]),...urls])],discoveredVia:page,title:race.name,checkedAt:today};
 },failedRequestHandler:async({request},e)=>failures.push({id:request.userData.id,url:request.url,error:e.message.slice(0,100)})
},new Configuration({persistStorage:false}));
await crawler.run(races.filter(r=>r.sourceDetailUrl&&/marathongo\.co\.kr/.test(r.sourceDetailUrl)).map(r=>({url:r.sourceDetailUrl,userData:{id:r.id},uniqueKey:r.id})));
// Primary pages found through independent searches, with explicit evidence kept.
for(const r of races){
 if(r.name.includes('경기화성 생태'))saved.entries[r.id]={urls:['https://kiccrace.com/hwasung1'],discoveredVia:'https://kiccrace.com/hwasung1',title:r.name,checkedAt:today};
 if(r.name.includes('자원봉사 사랑'))saved.entries[r.id]={urls:['https://xn--oi2bo7bn3do4es0j56afy5b.kr/'],discoveredVia:'https://runin.kr/race/'+encodeURIComponent('제20회-자원봉사-사랑-굿펀-마라톤')+'/',title:r.name,checkedAt:today};
 const direct=publicSourceUrl(r.officialUrl);if(direct&&isOrganizerPage(direct)){
  const old=saved.entries[r.id];saved.entries[r.id]={urls:[...new Set([...(old?.urls||[]),direct])],discoveredVia:old?.discoveredVia||r.sourceDetailUrl||direct,title:r.name,checkedAt:today};
 }
}
const overrides=JSON.parse(await readFile(join(root,'data/race-official-source-overrides.json'),'utf8'));
for(const [id,v]of Object.entries(overrides.entries))if(races.some(r=>r.id===id))saved.entries[id]={...v,title:races.find(r=>r.id===id).name,checkedAt:today};
await writeFile(file,JSON.stringify(saved,null,2)+'\n');await mkdir(join(root,'outputs/operations'),{recursive:true});
await writeFile(join(root,'outputs/operations/official-source-discovery.json'),JSON.stringify({checkedAt:today,found:Object.keys(saved.entries).length,failures},null,2)+'\n');
console.log(JSON.stringify({officialSourceEntries:Object.keys(saved.entries).length,failures:failures.length}));
