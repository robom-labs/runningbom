// Maintenance staging only. Caller publishes only after enrichment + all contracts pass.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {assessOfficialCourseChange} from './course-source-refresh-core.mjs';
import{readCourseBase}from'./course-metadata-inputs.mjs';
const root=new URL('../',import.meta.url),base=await readCourseBase(root),input=base.writeURL;
const courses=base.courses,updates=[],failures=[];
if(courses.filter(c=>c.sourceKind==='official-gpx').length>32)throw Error('Official source batch limit exceeded; last-good data retained');
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
for(const course of courses.filter(c=>c.sourceKind==='official-gpx')){
 try{const [pageText,gpxText]=await Promise.all([get(course.sourcePage),get(course.sourceUrl)]);updates.push(assessOfficialCourseChange(course,{pageText,gpxText,checkedAt:new Date().toISOString().slice(0,10)}));}
 catch(error){failures.push({id:course.id,reason:error.message});}
}
const report={checkedAt:new Date().toISOString(),existingOfficialCoursesOnly:true,updates:updates.map(u=>({id:u.course.id,changed:u.changed,geometryChanged:u.geometryChanged})),failures,published:false};
await mkdir(new URL('outputs/operations/',root),{recursive:true});await writeFile(new URL('outputs/operations/course-source-refresh.json',root),JSON.stringify(report,null,2)+'\n');
if(failures.length)throw Error('Official course check failed; no staged course sources changed');
if(process.argv.includes('--write'))await writeFile(input,JSON.stringify(courses.map(c=>updates.find(u=>u.course.id===c.id)?.course??c))+'\n');
console.log(JSON.stringify(report));
