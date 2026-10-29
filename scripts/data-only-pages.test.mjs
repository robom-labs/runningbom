import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {prepareDataOnlyPages,DATA_ONLY_PATHS,dataOnlyFailureReport} from './data-only-pages.mjs';
import {STATIC_DATA_FILES,sha256Text,byteSize,contentVersionFor} from './static-data-core.mjs';
import {REQUIRED_PERIOD_REVISITS} from './race-refresh-targets.mjs';
const now=Date.parse('2026-10-22T10:00:00Z');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'runningbom-data-only-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'main'),published=join(root,'gh-pages');
 const rows=Array.from({length:20},(_,i)=>({id:'race-'+i,name:'제'+i+'회 검증 대회',region:'서울',venue:'공원 '+i,date:'2026-11-15',distances:['10K'],sourceName:'주최측',sourceDetailUrl:'https://organizer.example/'+i}));
 const raw={version:'2026.10.22-race-data-92',lastSuccessfulRefreshAt:new Date(now-1000).toISOString(),sourceRefreshAudit:{checkedAt:new Date(now-1000).toISOString(),targets:REQUIRED_PERIOD_REVISITS.map(url=>({url,outcome:'parsed'}))},featuredRaces:[],scheduleFeed:rows};
 const payloads=Object.fromEntries(STATIC_DATA_FILES.map(file=>[file,JSON.stringify({schemaVersion:1,contentVersion:file==='races.json'?raw.version:'fixture-v1',records:file==='races.json'?rows:[]})+'\n']));
 const checksums=Object.fromEntries(STATIC_DATA_FILES.map(f=>[f,sha256Text(payloads[f])]));
 const manifest={schemaVersion:1,minimumAppVersion:'0.19.0',generatedAt:new Date(now-1000).toISOString(),contentVersion:contentVersionFor(checksums),checksums,sizes:Object.fromEntries(STATIC_DATA_FILES.map(f=>[f,byteSize(payloads[f])])),recordCounts:Object.fromEntries(STATIC_DATA_FILES.map(f=>[f,f==='races.json'?20:0]))};
 const write=async(root,path,text)=>{await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);};
 await write(source,'outputs/pushrun-site/races.json',JSON.stringify(raw));
 await write(source,'outputs/pushrun-site/app.js','UNRELEASED CODE MUST NEVER PUBLISH');
 for(const [file,text]of Object.entries(payloads))await write(source,'data/'+file,text);
 await write(source,'data/manifest.json',JSON.stringify(manifest));
 await write(source,'data/race-official-corrections.json',JSON.stringify({schemaVersion:1,entries:[]}));
 await write(published,'data/manifest.json',JSON.stringify({...manifest,generatedAt:'2026-10-20T00:00:00Z'}));
 await write(published,'races.json',JSON.stringify({...raw,version:'2026.10.20-race-data-91'}));
 for(const [file,text]of Object.entries({'index.html':'DEPLOYED HTML','app.js':'DEPLOYED JS','styles.css':'DEPLOYED CSS','sw.js':'DEPLOYED SERVICE WORKER','CNAME':'example.org','.nojekyll':'','assets/keep.svg':'KEEP','data/unrelated.json':'KEEP'}))await write(published,file,text);
 return {sourceDir:source,publishedDir:published,now,raw,manifest,write};
}
test('publication preserves every deployed non-data byte; unpublished main app is ignored; repeat is idempotent',async t=>{
 const f=await fixture(t),result=await prepareDataOnlyPages(f);
 assert.equal(result.ok,true);assert.equal(result.appCodePreserved,true);
 assert.deepEqual(result.changedPaths,[...DATA_ONLY_PATHS]);
 for(const [file,text]of Object.entries({'index.html':'DEPLOYED HTML','app.js':'DEPLOYED JS','styles.css':'DEPLOYED CSS','sw.js':'DEPLOYED SERVICE WORKER','CNAME':'example.org','assets/keep.svg':'KEEP','data/unrelated.json':'KEEP'}))assert.equal(await readFile(join(f.publishedDir,file),'utf8'),text);
 const repeated=await prepareDataOnlyPages(f);assert.deepEqual(repeated.changedPaths,[]);assert.equal(repeated.nonDataTreeSha256,result.nonDataTreeSha256);
});
test('corrupt/stale/newer-app/duplicate sidecar candidates fail before touching any live staging file',async t=>{
 for(const kind of ['checksum','stale','compatibility','duplicate','revision','future','missing-revisit']){
  const f=await fixture(t),old=await readFile(join(f.publishedDir,'races.json'),'utf8');
  if(kind==='checksum')await f.write(f.sourceDir,'data/races.json','corrupt');
  if(kind==='missing-revisit')await f.write(f.sourceDir,'outputs/pushrun-site/races.json',JSON.stringify({...f.raw,sourceRefreshAudit:undefined}));
  if(kind==='stale')await f.write(f.sourceDir,'outputs/pushrun-site/races.json',JSON.stringify({...f.raw,lastSuccessfulRefreshAt:'2026-10-01T00:00:00Z'}));
  if(kind==='compatibility')await f.write(f.sourceDir,'data/manifest.json',JSON.stringify({...f.manifest,minimumAppVersion:'0.23.0'}));
  if(kind==='future')await f.write(f.sourceDir,'data/manifest.json',JSON.stringify({...f.manifest,generatedAt:'2027-01-01T00:00:00Z'}));
  if(kind==='revision'||kind==='duplicate'){
   const dataset=JSON.parse(await readFile(join(f.sourceDir,'data/races.json'),'utf8'));
   if(kind==='revision')dataset.contentVersion='wrong';else dataset.records[1].id=dataset.records[0].id;
   const text=JSON.stringify(dataset);await f.write(f.sourceDir,'data/races.json',text);
   await f.write(f.sourceDir,'data/manifest.json',JSON.stringify({...f.manifest,checksums:{...f.manifest.checksums,'races.json':sha256Text(text)},sizes:{...f.manifest.sizes,'races.json':byteSize(text)}}));
  }
  await assert.rejects(prepareDataOnlyPages(f));assert.equal(await readFile(join(f.publishedDir,'races.json'),'utf8'),old);
 }
});
test('publication cannot initialize/replace missing app, follow symlinks, or downgrade newer deployed data',async t=>{
 for(const kind of ['missing-app','symlink','downgrade']){
  const f=await fixture(t);
  if(kind==='missing-app')await rm(join(f.publishedDir,'app.js'));
  if(kind==='symlink'){await rm(join(f.publishedDir,'data'),{recursive:true});await symlink(join(f.sourceDir,'data'),join(f.publishedDir,'data'));}
  if(kind==='downgrade')await f.write(f.publishedDir,'data/manifest.json',JSON.stringify({...f.manifest,generatedAt:new Date(now+1000).toISOString()}));
  await assert.rejects(prepareDataOnlyPages(f));
 }
});
test('independent Git guard rejects executable/staged/deleted or untracked app changes',async t=>{
 const f=await fixture(t),cwd=f.publishedDir;
 const git=args=>execFileSync('git',args,{cwd,stdio:'pipe'});
 git(['init','--quiet']);git(['add','.']);git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','baseline']);
 const guard=new URL('./check-data-only-diff.mjs',import.meta.url);
 const check=()=>execFileSync(process.execPath,[guard.pathname],{cwd,stdio:'pipe'});
 check();await f.write(cwd,'races.json','{}');check();
 await f.write(cwd,'app.js','UNAPPROVED');assert.throws(check);
});
test('workflow route cannot publish app web from push/schedule or routine recovery',async()=>{
 const read=file=>readFile(new URL('../.github/workflows/'+file,import.meta.url),'utf8');
 const pages=await read('pages.yml'),refresh=await read('refresh-race-data.yml'),watchdog=await read('data-watchdog.yml'),data=await read('data-only-pages.yml');
 assert.match(pages,/if: github.event_name == 'workflow_dispatch' && inputs.publish_app_web == true/);
 assert.doesNotMatch(pages,/cron:/);assert.match(data,/cron: "47 18 \* \* \*"/);
 for(const s of [refresh,watchdog]){assert.doesNotMatch(s,/gh workflow run pages.yml/);assert.match(s,/gh workflow run data-only-pages.yml/);}
 assert.match(data,/ref: gh-pages/);assert.match(data,/group: pages/);
 assert.doesNotMatch(data,/peaceiris|expo|eas |npm .*export|publish_dir|cp -a outputs/);
 assert.match(data,/node ..\/scripts\/check-data-only-diff.mjs/);
 assert.match(data,/pages: write/);assert.match(data,/--method POST.*pages\/builds/);
 assert.match(data,/\.source.branch == "gh-pages"/);
 assert.match(data,/Buffer.from\(await res.arrayBuffer\(\)\).equals\(expected\[index\]\)/);
});
test('KST day rollover rejects expired rows even while the 36-hour refresh clock is still fresh; last-good is untouched',async t=>{
 const f=await fixture(t),raw={...f.raw,scheduleFeed:f.raw.scheduleFeed.map(r=>({...r,date:'2026-10-22'}))};
 await f.write(f.sourceDir,'outputs/pushrun-site/races.json',JSON.stringify(raw));
 const before=await readFile(join(f.publishedDir,'races.json'),'utf8');
 await assert.rejects(prepareDataOnlyPages({...f,now:Date.parse('2026-10-22T15:00:01Z')}),error=>{
  const report=dataOnlyFailureReport(error);assert.equal(report.reason,'race-health-rejected');assert(report.details.includes('expired-races-present'));assert(!report.details.includes('successful-refresh-too-old'));return true;
 });
 assert.equal(await readFile(join(f.publishedDir,'races.json'),'utf8'),before);
});
test('safe failure artifact separates stale/past/sidecar faults without exposing arbitrary error contents or weakening rejection',()=>{
 const health=dataOnlyFailureReport(Error('race health rejected: 지난 대회 | 50시간 동안 성공하지 않았습니다.'));
 assert.deepEqual(health.details,['expired-races-present','successful-refresh-too-old']);assert.equal(health.ok,false);assert.equal(health.appCodePublished,false);
 assert.equal(dataOnlyFailureReport(Error('sidecar checksum/size mismatch')).reason,'sidecar-integrity');
 const unsafe=dataOnlyFailureReport(Error('https://user:secret@example.invalid/?token=SECRET private payload'));
 assert.equal(unsafe.reason,'validation-or-io-rejection');assert(!JSON.stringify(unsafe).includes('SECRET'));assert(!JSON.stringify(unsafe).includes('secret'));
});
