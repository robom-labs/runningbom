// Future cron wrapper: failed enrichment cannot veto valid image updates.
// No GPX route refresh here; the prior exact-source step remains fail-closed.
import{spawn}from'node:child_process';import{writeFile,mkdir}from'node:fs/promises';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{readCourseBase,readCourseElevation}from'./course-metadata-inputs.mjs';
import{assertApprovedGeometry,retainQualifiedProfiles}from'./course-elevation-maintenance-core.mjs';
const defaultRoot=new URL('../',import.meta.url),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function elevationInput(root){try{return await readCourseElevation(root);}catch(e){if(e.code!=='ENOENT')throw e;return{elevation:{schemaVersion:1,profiles:[]},url:null,writeURL:new URL('data/course-elevation.json',root)};}}
export function boundedLiveElevation({root=defaultRoot,maxLiveMs=120000,node=process.execPath}={}){
 return new Promise((resolveResult,reject)=>{
  const child=spawn(node,[new URL('scripts/update-course-elevation.mjs',root).pathname,'--refresh','--stdout','--overpass-only'],{cwd:root,stdio:['ignore','pipe','pipe']}),chunks=[];let size=0,reason;
  const stop=code=>{reason=code;child.kill('SIGKILL');};const timer=setTimeout(()=>stop('live-elevation-timeout'),maxLiveMs);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>16000000)stop('live-elevation-output-limit');else chunks.push(chunk);});
  // Do not forward provider output or use it as evidence on failure.
  child.stderr.on('data',chunk=>{size+=chunk.length;if(size>16000000)stop('live-elevation-output-limit');});
  child.on('error',e=>{clearTimeout(timer);reject(Error('live-elevation-spawn:'+e.code));});child.on('close',code=>{clearTimeout(timer);if(reason||code!==0)return reject(Error(reason||'live-elevation-exit:'+code));try{resolveResult(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('live-elevation-invalid-json'));}});
 });
}
export async function maintainCourseElevation({root=defaultRoot,write=false,check=false,maxLiveMs=120000,now=Date.now(),liveRunner=boundedLiveElevation}={}){
 if(check&&write)throw Error('--check and --write are mutually exclusive');if(!Number.isInteger(maxLiveMs)||maxLiveMs<1||maxLiveMs>180000)throw Error('Live elevation wall budget invalid');
 const [base,previous]=await Promise.all([readCourseBase(root),elevationInput(root)]),courses=base.courses.filter(c=>c.sourceKind==='official-gpx');assertApprovedGeometry(courses);
 const retained=retainQualifiedProfiles(courses,previous.elevation,{now});
 if(check){if(retained.dropped.length)throw Error('Stored profiles fail strict qualification: '+JSON.stringify(retained.dropped));return{check:true,offline:true,rewritten:false,profiles:retained.elevation.profiles.length,geometryOnly:retained.geometryOnly};}
 let selected=retained,status='no-official-gpx',failure=null;
 if(courses.length)try{const candidate=await liveRunner({root,maxLiveMs}),qualified=retainQualifiedProfiles(courses,{...candidate,...(retained.elevation.originalGPXPolicies?{originalGPXPolicies:retained.elevation.originalGPXPolicies}:{})},{now});if(qualified.dropped.length||qualified.geometryOnly.length)throw Error('live-profile-cannot-qualify');selected=qualified;status='live-qualified';}catch(e){failure={code:'LIVE_ELEVATION_FAILED',reason:String(e.message).slice(0,200).replace(/\/(?:Users|Volumes)\/[^\s]+/g,'[local-path]')};status=selected.elevation.profiles.length?'degraded-retained-qualified':'degraded-geometry-only';}
 const [currentBase,currentElevation]=await Promise.all([readCourseBase(root),elevationInput(root)]);if(currentBase.url.href!==base.url.href||currentElevation.url?.href!==previous.url?.href||!same(currentBase.courses,base.courses)||!same(currentElevation.elevation,previous.elevation))throw Error('Concurrent course metadata change; refusing maintenance write');
 const health={schemaVersion:1,reportedAt:new Date(now).toISOString(),status,liveFailure:failure,maxLiveMs,liveStructurePolicy:'overpass-only; no original OSM API requests',retainedProfiles:selected.elevation.profiles.map(p=>({courseId:p.courseId,checkedAt:p.checkedAt,routeHash:p.routeHash,officialGPXsha:p.officialGPXsha})),droppedPreviousProfiles:retained.dropped,geometryOnly:selected.geometryOnly,blockedOriginalGPX:selected.blockedOriginalGPX,originalGPXDemConversionAllowed:false,collectorFailureRecertifiesNothing:true,published:false};
 if(write){await mkdir(new URL('./',previous.writeURL),{recursive:true});await writeFile(previous.writeURL,JSON.stringify(selected.elevation,null,2)+'\n');await mkdir(new URL('outputs/operations/',root),{recursive:true});await writeFile(new URL('outputs/operations/course-elevation-health.json',root),JSON.stringify(health,null,2)+'\n');}
 return{elevation:selected.elevation,health,rewritten:write};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),value=args.indexOf('--max-live-ms');for(let i=0;i<args.length;i++){if(args[i]==='--max-live-ms'){if(!/^\d+$/.test(args[++i]||''))throw Error('Numeric live wall budget required');}else if(!['--write','--check'].includes(args[i]))throw Error('Use --write or --check [--max-live-ms 1000..180000]');}const maxLiveMs=value<0?120000:Number(args[value+1]);if(maxLiveMs<1000)throw Error('CLI live wall budget below 1000ms');
 maintainCourseElevation({write:args.includes('--write'),check:args.includes('--check'),maxLiveMs}).then(r=>{if(r.health?.liveFailure)console.error('::warning::Elevation provider failed; strictly qualified retained profiles / geometry-only fallback; see course-elevation-health.json');console.log(JSON.stringify(r.health||r));}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
