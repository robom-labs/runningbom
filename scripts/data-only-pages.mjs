// Overlay a closed JSON allowlist onto the CURRENT gh-pages tree. No network or app build.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,lstat,readdir,realpath} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STATIC_DATA_FILES,assertStaticManifest,sha256Text,byteSize} from './static-data-core.mjs';
import {assessRaceDataset,raceRows} from './race-health-core.mjs';
import {correctionProblems,nativeCorrectionProblems} from './race-corrections.mjs';
import {periodRevisitProblems} from './race-refresh-targets.mjs';
export const DATA_ONLY_PATHS=Object.freeze(['races.json','data/manifest.json',...STATIC_DATA_FILES.map(name=>'data/'+name)]);
const permitted=new Set(DATA_ONLY_PATHS);
// Public health failures must remain failures, but not opaque ones. Report only
// fixed diagnostic codes: never serialize arbitrary errors, URLs or payloads.
export function dataOnlyFailureReport(error){
 const message=String(error?.message||''),rules=[
  ['race health rejected:','race-health-rejected'],['required period source revisit','period-revisit-missing'],
  ['protected raw corrections','protected-raw-corrections'],['protected native corrections','protected-native-corrections'],
  ['sidecar checksum/size','sidecar-integrity'],['sidecar count/schema','sidecar-schema'],
  ['root/sidecar revision or count','race-projection-binding'],['duplicate/missing race ID','race-identity'],
  ['app compatibility change','app-compatibility-change'],['publication downgrade','publication-downgrade'],
  ['publication count drop','publication-count-drop'],['future manifest','future-manifest'],
  ['existing deployed app missing','missing-existing-app'],['unsafe publication path','unsafe-path'],
  ['symlink in published tree','unsafe-path'],['non-data publication tree changed','non-data-mutation']
 ];
 const reason=rules.find(([prefix])=>message.startsWith(prefix))?.[1]||'validation-or-io-rejection';
 const details=reason==='race-health-rejected'?[
  ...(message.includes('지난 대회')?['expired-races-present']:[]),
  ...(message.includes('시간 동안 성공')?['successful-refresh-too-old']:[]),
  ...(message.includes('5분 이상 미래')?['future-successful-refresh']:[])
 ]:[];
 return{ok:false,code:'data-only-publication-rejected',reason,details,appCodePublished:false};
}
async function plain(root,relative){
 for(const [i,part] of relative.split('/').entries()){
  const path=join(root,...relative.split('/').slice(0,i+1));
  try{const stat=await lstat(path);if(stat.isSymbolicLink()||(!stat.isDirectory()&&part!==relative.split('/').at(-1)))throw Error('unsafe publication path');}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
async function nonDataTree(root,prefix=''){
 const rows=[];
 for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
  const path=prefix?prefix+'/'+entry.name:entry.name;if(path==='.git')continue;
  if(entry.isSymbolicLink())throw Error('symlink in published tree');
  if(entry.isDirectory())rows.push(...await nonDataTree(root,path));
  else if(!permitted.has(path))rows.push([path,sha256Text(await readFile(join(root,path)))]);
 }
 return rows.sort(([a],[b])=>a.localeCompare(b));
}
export async function prepareDataOnlyPages({sourceDir,publishedDir,now=Date.now()}){
 const source=await realpath(sourceDir),published=await realpath(publishedDir);
 if(source===published||source.startsWith(published+'/'))throw Error('publication root overlaps source');
 for(const file of ['index.html','app.js']){await plain(published,file);if(!(await lstat(join(published,file))).isFile())throw Error('existing deployed app missing');}
 const inputPaths={'races.json':'outputs/pushrun-site/races.json',...Object.fromEntries(DATA_ONLY_PATHS.filter(p=>p.startsWith('data/')).map(p=>[p,p]))};
 const inputs={};
 for(const [destination,origin] of Object.entries(inputPaths)){
  await plain(source,origin);await plain(published,destination);
  inputs[destination]=await readFile(join(source,origin),'utf8');
 }
 const raw=JSON.parse(inputs['races.json']),health=assessRaceDataset({data:raw,now});
 if(!health.ok)throw Error('race health rejected: '+health.errors.join(' | '));
 if(periodRevisitProblems(raw.sourceRefreshAudit,now).length)throw Error('required period source revisit audit missing');
 const corrections=JSON.parse(await readFile(join(source,'data/race-official-corrections.json'),'utf8'));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(now));
 if(correctionProblems(raw,corrections,today).length)throw Error('protected raw corrections missing');
 const manifest=assertStaticManifest(JSON.parse(inputs['data/manifest.json']));
 const generated=Date.parse(manifest.generatedAt);
 if(generated>now+300000)throw Error('future manifest');
 for(const file of STATIC_DATA_FILES){
  const text=inputs['data/'+file],dataset=JSON.parse(text);
  if(sha256Text(text)!==manifest.checksums[file]||byteSize(text)!==manifest.sizes[file])throw Error('sidecar checksum/size mismatch');
  if(dataset.schemaVersion!==1||!Array.isArray(dataset.records)||dataset.records.length!==manifest.recordCounts[file])throw Error('sidecar count/schema mismatch');
 }
 const races=JSON.parse(inputs['data/races.json']);
 if(nativeCorrectionProblems(races.records,corrections,today).length)throw Error('protected native corrections missing');
 if(races.contentVersion!==raw.version||races.records.length!==raceRows(raw).length)throw Error('root/sidecar revision or count mismatch');
 if(new Set(races.records.map(r=>r.id)).size!==races.records.length||races.records.some(r=>typeof r.id!=='string'||!r.id))throw Error('duplicate/missing race ID');
 // Do not lower compatibility or overwrite a newer already-published dataset.
 const previousManifest=assertStaticManifest(JSON.parse(await readFile(join(published,'data/manifest.json'),'utf8')));
 if(manifest.minimumAppVersion!==previousManifest.minimumAppVersion)throw Error('app compatibility change is not data-only');
 if(generated<Date.parse(previousManifest.generatedAt))throw Error('publication downgrade');
 const previous=JSON.parse(await readFile(join(published,'races.json'),'utf8'));
 const previousFuture=raceRows(previous).filter(r=>String(r.raceDate??r.date).slice(0,10)>=today).length;
 if(health.metrics.total<Math.ceil(previousFuture*.6))throw Error('publication count drop');
 const before=await nonDataTree(published),changed=[];
 // All payloads validate before the first destination write. Only local staging is modified.
 for(const file of DATA_ONLY_PATHS){
  let old=null;try{old=await readFile(join(published,file),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(old===inputs[file])continue;
  await mkdir(dirname(join(published,file)),{recursive:true});await writeFile(join(published,file),inputs[file]);changed.push(file);
 }
 const after=await nonDataTree(published);
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('non-data publication tree changed');
 const treeHash=createHash('sha256').update(JSON.stringify(before)).digest('hex');
 return {ok:true,changedPaths:changed,allowedPaths:DATA_ONLY_PATHS,nonDataTreeSha256:treeHash,appCodePreserved:true,raceVersion:raw.version,contentVersion:manifest.contentVersion,health:health.metrics};
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)){
 const value=flag=>{const i=process.argv.indexOf(flag);if(i<0||!process.argv[i+1])throw Error('required path argument missing');return resolve(process.argv[i+1]);};
 const report=new URL('../outputs/operations/data-only-publication.json',import.meta.url);
 let result;
 try{result=await prepareDataOnlyPages({sourceDir:value('--source'),publishedDir:value('--published')});}
 catch(error){result=dataOnlyFailureReport(error);process.exitCode=1;}
 await mkdir(dirname(fileURLToPath(report)),{recursive:true});await writeFile(report,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
