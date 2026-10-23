// Course registry publication: two JSON files only, no app/binary/OTA deployment.
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildElevationProfile,elevationRouteHash} from '../apps/mobile/assets/course-src/elevation-profile.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=text=>createHash('sha256').update(text).digest('hex');
export const coursePublicationAllowlist=['data/course-catalog.json','data/course-catalog.manifest.json'];
export function assertCoursePagesSource(config){if(config?.build_type!=='legacy'||config?.source?.branch!=='gh-pages'||config?.source?.path!=='/')throw Error('Existing Pages source must remain legacy/gh-pages/root');}
export function verifyCoursePair(text,manifest,{now=Date.now(),fresh=true,approvedCourses}={}){
  const data=JSON.parse(text),courses=data.courses,profiles=data.elevation?.profiles;
  if(data.schemaVersion!==1||manifest.schemaVersion!==1||data.elevation?.schemaVersion!==1||!Array.isArray(courses)||!courses.length||!Array.isArray(profiles)||!/^courses-[a-f0-9]{20}$/.test(data.revision??'')||manifest.revision!==data.revision||manifest.generatedAt!==data.generatedAt||manifest.count!==courses.length||manifest.sizeBytes!==Buffer.byteLength(text)||manifest.sha256!==digest(text)||!/^\d+\.\d+\.\d+$/.test(manifest.minimumAppVersion??''))throw Error('Invalid course payload/manifest pair');
  const at=Date.parse(data.generatedAt);if(!Number.isFinite(at)||at>now+300000||(fresh&&now-at>8*86400000))throw Error('Stale/invalid course registry timestamp');
  const ids=new Set(),profileIds=new Set();
  for(const p of profiles){if(!p?.courseId||profileIds.has(p.courseId)||!courses.some(c=>c.id===p.courseId))throw Error('Duplicate/orphan elevation profile');profileIds.add(p.courseId);}
  for(const c of courses){
    if(!c?.id||ids.has(c.id)||!c.eventId||!/^\d{4}-\d{2}-\d{2}$/.test(c.raceDate??'')||!['official-gpx','official-image'].includes(c.sourceKind)||!Array.isArray(c.segments))throw Error('Invalid course identity/edition');ids.add(c.id);
    for(const key of ['sourceUrl',...(c.imageUrl?['imageUrl']:[])]){let u;try{u=new URL(c[key]);}catch{throw Error('Invalid course source URL');}if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS course provenance required');}
    if(approvedCourses){const approved=approvedCourses.find(a=>a.id===c.id);if(!approved||approved.eventId!==c.eventId||approved.raceDate!==c.raceDate||approved.sourceKind!==c.sourceKind||approved.sourceUrl!==c.sourceUrl||approved.sourceSha256!==c.sourceSha256||approved.imageUrl!==c.imageUrl||elevationRouteHash(approved)!==elevationRouteHash(c))throw Error('Course differs from current approved source rows');}
    const e=profiles.find(p=>p.courseId===c.id);
    if(c.sourceKind==='official-gpx'&&!buildElevationProfile(c,e).available)throw Error('Source-bound GPX elevation unavailable');
    if(c.sourceKind==='official-image'&&(c.segments.length||e))throw Error('Image-only course cannot claim route/elevation');
  }
  if(approvedCourses&&approvedCourses.length!==courses.length)throw Error('Course registry omits approved rows');
  return {count:courses.length,elevationProfiles:profiles.length,revision:data.revision,sha256:manifest.sha256};
}
async function hashes(dir,prefix=''){
  const out={};for(const e of await readdir(join(dir,prefix),{withFileTypes:true})){if(e.name==='.git')continue;const rel=prefix?prefix+'/'+e.name:e.name,p=join(dir,rel),st=await lstat(p);if(st.isSymbolicLink())throw Error('Symlink in publication tree');if(st.isDirectory())Object.assign(out,await hashes(dir,rel));else if(st.isFile())out[rel]=digest(await readFile(p));}return out;
}
export function assertCourseOnlyDelta(before,after){const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);if(changed.some(p=>!coursePublicationAllowlist.includes(p)))throw Error('Non-course publication mutation refused');return changed;}
async function localPair(dataDir){return Promise.all(['course-catalog.json','course-catalog.manifest.json'].map(f=>readFile(join(dataDir,f),'utf8')));}
export async function readApprovedCourses(base=new URL('../apps/mobile/domains/races/',import.meta.url),imagesUrl=new URL('../data/course-approved-images.json',import.meta.url)){
  const primary=JSON.parse(await readFile(new URL('course-examples.json',base),'utf8'));
  let images=[];try{const value=JSON.parse(await readFile(imagesUrl,'utf8'));images=Array.isArray(value)?value:value.courses;if(!Array.isArray(images))throw Error('Approved image registry must be an array or {courses:[]}');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!Array.isArray(primary)||images.some(c=>c.sourceKind!=='official-image'||!Array.isArray(c.segments)||c.segments.length))throw Error('Approved image registry cannot authorize GPX geometry');
  const courses=[...primary,...images];if(new Set(courses.map(c=>c.id)).size!==courses.length)throw Error('Duplicate approved course IDs');return courses;
}
export async function overlayCourseRegistry(siteDir,dataDir,{now=Date.now(),approvedCourses}={}){
  const [text,manifestText]=await localPair(dataDir),manifest=JSON.parse(manifestText),report=verifyCoursePair(text,manifest,{now,approvedCourses}),before=await hashes(siteDir);
  const exists=coursePublicationAllowlist.map(p=>Object.hasOwn(before,p));if(exists.some(Boolean)&&!exists.every(Boolean))throw Error('Existing course pair incomplete');
  if(exists.every(Boolean)){const [old,oldManifestText]=await localPair(join(siteDir,'data')),oldManifest=JSON.parse(oldManifestText),previous=verifyCoursePair(old,oldManifest,{now,fresh:false});if(Date.parse(manifest.generatedAt)<Date.parse(oldManifest.generatedAt)||report.count<Math.ceil(previous.count*.6))throw Error('Course downgrade/count-drop refused');}
  await mkdir(join(siteDir,'data'),{recursive:true});await writeFile(join(siteDir,coursePublicationAllowlist[0]),text);await writeFile(join(siteDir,coursePublicationAllowlist[1]),manifestText);
  return {...report,changed:assertCourseOnlyDelta(before,await hashes(siteDir)),nonCourseFilesUnchanged:true};
}
async function publicText(url,fetcher){const r=await fetcher(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Public course verification HTTP ${r.status}`);let n=0,parts=[];for await(const chunk of r.body){n+=chunk.byteLength;if(n>8_000_000)throw Error('Public response too large');parts.push(Buffer.from(chunk));}return Buffer.concat(parts).toString('utf8');}
export async function verifyPublicCourseRegistry(dataDir,{siteDir,fetcher=fetch,now=Date.now()}={}){
  const [expectedText,expectedManifestText]=await localPair(dataDir),expected=verifyCoursePair(expectedText,JSON.parse(expectedManifestText),{now});
  const [text,manifestText]=await Promise.all(coursePublicationAllowlist.map(p=>publicText('https://robom-labs.github.io/runningbom/'+p+'?course-check='+now,fetcher)));
  const actual=verifyCoursePair(text,JSON.parse(manifestText),{now});if(actual.sha256!==expected.sha256||actual.revision!==expected.revision)throw Error('Public course pair is not candidate revision');
  if(siteDir)for(const p of ['index.html','app.js','styles.css','sw.js']){const before=await readFile(join(siteDir,p)),served=await publicText('https://robom-labs.github.io/runningbom/'+p+'?course-check='+now,fetcher);if(digest(before)!==digest(served))throw Error('Existing served app bytes changed: '+p);}
  return {...actual,publicPairVerified:true,servedAppBytesVerified:!!siteDir};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined;
  const dataDir=resolve(value('--data-dir')||join(root,'data')),siteDir=value('--site-dir');
  if(args.includes('--assert-pages')){let text='';for await(const x of process.stdin)text+=x;assertCoursePagesSource(JSON.parse(text));console.log('Existing Pages source verified (no configuration mutation)');}
  else if(args.includes('--verify-public'))console.log(JSON.stringify(await verifyPublicCourseRegistry(dataDir,{siteDir})));
  else{const approvedCourses=await readApprovedCourses();if(args.includes('--check')){const [text,m]=await localPair(dataDir);console.log(JSON.stringify(verifyCoursePair(text,JSON.parse(m),{approvedCourses})));}else{if(!siteDir)throw Error('--site-dir or --check required');console.log(JSON.stringify(await overlayCourseRegistry(resolve(siteDir),dataDir,{approvedCourses})));}}
}
