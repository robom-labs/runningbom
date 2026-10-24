// Maintenance staging only. Caller publishes only after enrichment + all contracts pass.
import {writeFile,mkdir} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessOfficialCourseChange} from './course-source-refresh-core.mjs';
import {readCourseBase,readCourseElevation} from './course-metadata-inputs.mjs';
const defaultRoot=new URL('../',import.meta.url);
async function get(raw){
 const url=new URL(raw);url.hash='';
 if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||!url.hostname.includes('.'))throw Error('Public official HTTPS endpoint required');
 const addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(({address:a})=>isIP(a)===4?/^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|22[4-9]\.|23\d\.)/.test(a):/^([:]|f[cd]|fe[89ab])/i.test(a)))throw Error('Nonpublic source address');
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{'user-agent':'RunningbomCourseMaintenance/1 (+https://robom.kr)'}});
 if(!r.ok)throw Error('Official source HTTP '+r.status);
 let size=0,parts=[];for await(const chunk of r.body){size+=chunk.byteLength;if(size>2_000_000)throw Error('Official source too large');parts.push(Buffer.from(chunk));}
 return Buffer.concat(parts).toString('utf8');
}
export async function refreshApprovedCourseSources({root=defaultRoot,check=false,write=false,getSource=get,now=new Date()}={}){
 if(check&&write)throw Error('--check and --write are mutually exclusive');
 const [base,elevation]=await Promise.all([readCourseBase(root),readCourseElevation(root)]),input=base.writeURL;
 const courses=base.courses,updates=[],failures=[],official=courses.filter(c=>c.sourceKind==='official-gpx');
 if(official.length>32)throw Error('Official source batch limit exceeded; last-good data retained');
 const metadata={baseInput:base.url.href,baseWriteURL:input.href,elevationInput:elevation.url.href,elevationWriteURL:elevation.writeURL.href,profiles:elevation.elevation.profiles.length};
 // Offline contract check only: no source requests, reports, directories or writes.
 if(check)return{ok:true,check:true,offline:true,rewritten:false,officialCourses:official.length,...metadata,published:false};
 for(const course of official){
  try{const [pageText,gpxText]=await Promise.all([getSource(course.sourcePage),getSource(course.sourceUrl)]);updates.push(assessOfficialCourseChange(course,{pageText,gpxText,checkedAt:now.toISOString().slice(0,10)}));}
  catch(error){failures.push({id:course.id,reason:error.message});}
 }
 const report={checkedAt:now.toISOString(),existingOfficialCoursesOnly:true,...metadata,updates:updates.map(u=>({id:u.course.id,changed:u.changed,geometryChanged:u.geometryChanged})),failures,rewritten:false,published:false};
 if(failures.length)throw Error('Official course check failed; no staged course sources changed: '+JSON.stringify(failures));
 if(write){
  // Refuse to overwrite metadata replaced during network collection, including a
  // newly introduced canonical file while this run was using legacy fallback.
  const [currentBase,currentElevation]=await Promise.all([readCourseBase(root),readCourseElevation(root)]);
  if(currentBase.url.href!==base.url.href||currentElevation.url.href!==elevation.url.href||JSON.stringify(currentBase.courses)!==JSON.stringify(courses)||JSON.stringify(currentElevation.elevation)!==JSON.stringify(elevation.elevation))throw Error('Course metadata changed during refresh; refusing overwrite');
  await mkdir(new URL('./',input),{recursive:true});
  await writeFile(input,JSON.stringify(courses.map(c=>updates.find(u=>u.course.id===c.id)?.course??c))+'\n');
  report.rewritten=true;
  // Elevation is read-only here. Geometry changes must pass the existing later
  // enrichment/qualification chain before publication; never mint a profile.
  await mkdir(new URL('outputs/operations/',root),{recursive:true});await writeFile(new URL('outputs/operations/course-source-refresh.json',root),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.some(a=>!['--check','--write'].includes(a)))throw Error('Use --check or --write');
 console.log(JSON.stringify(await refreshApprovedCourseSources({check:args.includes('--check'),write:args.includes('--write')})));
}
