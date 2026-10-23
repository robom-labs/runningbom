// Bounded JSON-only overlay of CURRENT main onto CURRENT gh-pages. No app/site build.
import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{readFile,mkdir,writeFile,rm}from'node:fs/promises';import{join,resolve}from'node:path';import{pathToFileURL}from'node:url';
import{raceRepresentativeRejection}from'./race-image-guard.mjs';
export const RACE_IMAGE_PATH='data/race-images.json';
export const REPO='robom-labs/runningbom';
const sha=value=>createHash('sha256').update(value).digest('hex');
function publicUrl(value,source=false){try{const u=new URL(value);return (u.protocol==='https:'||source&&u.protocol==='http:')&&!u.username&&!u.password&&!u.port&&!/^(localhost$|.*\.local$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname);}catch{return false;}}
function day(value){return typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function verifyRaceImageMetadata(text,{now=Date.now(),rejections={entries:{}}}={}){
 if(Buffer.byteLength(text)>1000000)throw Error('Race image metadata exceeds 1MB');
 const d=JSON.parse(text),entries=Object.entries(d?.images??{});
 if(d.schemaVersion!==1||!Number.isSafeInteger(d.revision)||d.revision<1||!day(d.checkedAt)||Date.parse(d.checkedAt)>now+86400000||!d.images||Array.isArray(d.images)||entries.length<1||entries.length>1000)throw Error('Invalid race image metadata envelope');
 // Preserve observed legacy HTTP provenance; the actual app image URL stays HTTPS.
 for(const[id,p]of entries){if(!/^[a-zA-Z0-9_-]{1,150}$/.test(id)||!p||!publicUrl(p.url)||p.url.length>600||!publicUrl(p.sourceUrl,true)||typeof p.source!=='string'||!p.source||!day(p.checkedAt)||Date.parse(p.checkedAt)>now+86400000||!/^20\d{2}$/.test(p.edition||'')||!/^[a-f0-9]{64}$/.test(p.sha256||'')||!Number.isFinite(p.width)||p.width<=0||!Number.isFinite(p.height)||p.height<=0||typeof p.kind!=='string'||!p.kind||raceRepresentativeRejection(p,rejections.entries?.[id]))throw Error('Invalid or rejected race image: '+id);}
 return{data:d,revision:d.revision,count:entries.length,checkedAt:d.checkedAt,sha256:sha(text),bytes:Buffer.byteLength(text)};
}
export function assertRaceImageAdvance(previous,next){
 if(next.revision<previous.revision||next.checkedAt<previous.checkedAt)throw Error('Race image metadata rollback');
 if(next.revision===previous.revision&&JSON.stringify(next)!==JSON.stringify(previous))throw Error('Conflicting race image revision');
 for(const[id,p]of Object.entries(previous.images))if(!next.images[id]||next.images[id].checkedAt<p.checkedAt)throw Error('Missing/older last-good image: '+id);
}
export function assertImageOnlyDelta(paths){if(paths.some(p=>p!==RACE_IMAGE_PATH))throw Error('Non-image-metadata tree mutation');return paths;}
export function assertRaceImagePages(config){if(config?.build_type!=='legacy'||config?.source?.branch!=='gh-pages'||config?.source?.path!=='/')throw Error('Existing Pages source changed');return{build_type:config.build_type,source:config.source,cname:config.cname,https_enforced:config.https_enforced,public:config.public};}
const identity={GIT_AUTHOR_NAME:'robom-data-bot',GIT_AUTHOR_EMAIL:'actions@github.com',GIT_COMMITTER_NAME:'robom-data-bot',GIT_COMMITTER_EMAIL:'actions@github.com'};
const git=(cwd,args,options={})=>execFileSync('git',args,{cwd,encoding:'utf8',timeout:90000,maxBuffer:4000000,...options,env:{...process.env,...identity,...options.env}}).trimEnd();
function optionalBlob(cwd,ref,path){try{return git(cwd,['show',ref+':'+path],{stdio:['pipe','pipe','pipe']})+'\n';}catch(error){if(error.status===128)return null;throw error;}}
export async function stageRaceImageOverlay({cwd,mainRef='origin/main',pagesRef='origin/gh-pages',now=Date.now()}){
 const mainSha=git(cwd,['rev-parse',mainRef]),parent=git(cwd,['rev-parse',pagesRef]);
 // Read raw bytes without trim/re-serialization. The published JSON must equal main.
 const text=execFileSync('git',['show',mainSha+':'+RACE_IMAGE_PATH],{cwd,encoding:'utf8',maxBuffer:2000000});
 const rejectionText=optionalBlob(cwd,mainSha,'data/race-image-rejections.json');
 const report=verifyRaceImageMetadata(text,{now,rejections:rejectionText?JSON.parse(rejectionText):undefined});
 const old=optionalBlob(cwd,parent,RACE_IMAGE_PATH);
 if(old){const previous=verifyRaceImageMetadata(old,{now});assertRaceImageAdvance(previous.data,report.data);}
 const blob=git(cwd,['hash-object','-w','--stdin'],{input:text}),oldTree=git(cwd,['rev-parse',parent+'^{tree}']);
 const index=join(cwd,'.git','race-image-overlay-'+process.pid+'-'+Date.now());
 let tree;
 try{const env={GIT_INDEX_FILE:index};git(cwd,['read-tree',parent],{env});git(cwd,['update-index','--add','--cacheinfo','100644',blob,RACE_IMAGE_PATH],{env});tree=git(cwd,['write-tree'],{env});}finally{await rm(index,{force:true});}
 const changed=assertImageOnlyDelta(git(cwd,['diff','--name-only','-z',oldTree,tree]).split('\0').filter(Boolean));
 const before=git(cwd,['ls-tree','-r','-z',oldTree]).split('\0').filter(v=>v&&!v.endsWith('\t'+RACE_IMAGE_PATH));
 const after=git(cwd,['ls-tree','-r','-z',tree]).split('\0').filter(v=>v&&!v.endsWith('\t'+RACE_IMAGE_PATH));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Other gh-pages bytes/modes changed');
 const commit=changed.length?git(cwd,['commit-tree',tree,'-p',parent,'-m','fix(data): publish verified race image metadata only']):parent;
 const{data,...summary}=report;return{...summary,mainSha,parent,oldTree,tree,commit,changed,otherPagesTreeSha256:sha(before.join('\0')),otherPagesFiles:before.length,allOtherPagesBytesAndModesPreserved:true};
}
async function publicRead(url,fetcher){
 const response=await fetcher(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(response.status!==200)throw Error('Public race images HTTP '+response.status);
 if(!/application\/json/i.test(response.headers.get('content-type')||''))throw Error('Public race images not JSON');
 const chunks=[];let length=0;for await(const value of response.body){length+=value.byteLength;if(length>1000000)throw Error('Public metadata too large');chunks.push(Buffer.from(value));}return Buffer.concat(chunks).toString('utf8');
}
export async function verifyPublicRaceImages(expectedSha,{fetcher=fetch,now=Date.now(),cacheBust=false}={}){
 const url='https://robom-labs.github.io/runningbom/'+RACE_IMAGE_PATH+(cacheBust?'?race-image-check='+now:'');
 const text=await publicRead(url,fetcher),{data,...report}=verifyRaceImageMetadata(text,{now});
 if(report.sha256!==expectedSha)throw Error('Public metadata differs from committed main candidate');
 return{...report,url,httpStatus:200,actualPublicBytesVerified:true,targetSha256:data.images['schedule-20532f12abdb']?.sha256};
}
export function pushRaceImageCAS(cwd,report){
 const remote=git(cwd,['ls-remote','origin','refs/heads/main','refs/heads/gh-pages']);
 const refs=Object.fromEntries(remote.split('\n').map(line=>{const[sha,ref]=line.split(/\s+/);return[ref,sha];}));
 if(refs['refs/heads/main']!==report.mainSha)throw Error('main CAS changed');
 if(refs['refs/heads/gh-pages']===report.commit)return;
 if(refs['refs/heads/gh-pages']!==report.parent)throw Error('gh-pages CAS changed');
 if(report.changed.length)try{git(cwd,['push','origin',report.commit+':refs/heads/gh-pages']);}catch(error){
  const current=git(cwd,['ls-remote','origin','refs/heads/gh-pages']).split(/\s/)[0];
  if(current!==report.commit)throw error; // Reconcile an ambiguous successful push; never force/replay blindly.
 }
}
export async function publishRaceImages({cwd=process.cwd(),attempts=3,verifyAttempts=8}={}){
 const gh=args=>execFileSync('gh',args,{cwd,encoding:'utf8',timeout:30000,maxBuffer:1000000});
 const before=assertRaceImagePages(JSON.parse(gh(['api','repos/'+REPO+'/pages'])));let report;
 for(let attempt=1;attempt<=attempts;attempt++){
  git(cwd,['fetch','origin','main','gh-pages']);report=await stageRaceImageOverlay({cwd});
  try{pushRaceImageCAS(cwd,report);}catch(error){if(attempt===attempts)throw error;continue;}
  report.casAttempt=attempt;break;
 }
 const after=assertRaceImagePages(JSON.parse(gh(['api','repos/'+REPO+'/pages'])));if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Pages configuration differs');
 report.pagesConfigurationPreserved=true;
 if(report.changed.length)report.pagesBuild=JSON.parse(gh(['api','--method','POST','repos/'+REPO+'/pages/builds']));
 let served,lastError;
 for(let attempt=0;attempt<verifyAttempts;attempt++){
  try{await verifyPublicRaceImages(report.sha256,{cacheBust:true});served=await verifyPublicRaceImages(report.sha256);break;}catch(error){lastError=error;if(attempt+1<verifyAttempts)await new Promise(resolve=>setTimeout(resolve,15000));}
 }
 if(!served)throw lastError;report.public=served;return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 let report;
 if(process.argv.includes('--publish'))report=await publishRaceImages();
 else if(process.argv.includes('--verify-public')){const text=await readFile(resolve('data/race-images.json'),'utf8');report=await verifyPublicRaceImages(sha(text));}
 else{const text=await readFile(resolve('data/race-images.json'),'utf8'),rejections=JSON.parse(await readFile(resolve('data/race-image-rejections.json'),'utf8'));const{data,...summary}=verifyRaceImageMetadata(text,{rejections});report=summary;}
 await mkdir('outputs/operations',{recursive:true});await writeFile('outputs/operations/race-image-publication.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
