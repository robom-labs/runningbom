// Generate/check remote course data locally. This script does NOT deploy or push.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const baseCourses=await read('apps/mobile/domains/races/course-examples.json'),raw=await read('apps/mobile/domains/races/course-elevation.json');
let approvedImages=[];try{approvedImages=await read('data/course-approved-images.json');}catch(error){if(error.code!=='ENOENT')throw error;}
const courses=[...baseCourses,...approvedImages];
if(new Set(courses.map(c=>c.id)).size!==courses.length)throw Error('Duplicate course IDs');
const elevation={schemaVersion:1,profiles:raw.profiles};
const digest=value=>createHash('sha256').update(value).digest('hex');
const revision='courses-'+digest(JSON.stringify({courses,elevation})).slice(0,20);
const generatedAt=new Date(Math.max(...courses.map(c=>Date.parse(c.checkedAt)),...elevation.profiles.map(p=>Date.parse(p.checkedAt)))).toISOString();
const catalog={schemaVersion:1,revision,generatedAt,courses,elevation};
// The same app-side contract is run by tests before deployment/installation.
const text=JSON.stringify(catalog)+'\n',manifest=JSON.stringify({schemaVersion:1,revision,generatedAt,count:courses.length,sha256:digest(text),sizeBytes:Buffer.byteLength(text),minimumAppVersion:'0.23.4'})+'\n';
const files=[...(!process.argv.includes('--remote-only')?[['apps/mobile/domains/races/course-catalog.json',text]]:[]),['data/course-catalog.json',text],['data/course-catalog.manifest.json',manifest],['outputs/pushrun-site/data/course-catalog.json',text],['outputs/pushrun-site/data/course-catalog.manifest.json',manifest]];
const check=process.argv.includes('--check');
for(const [path,bytes] of files){const target=new URL(path,root);if(check){if(await readFile(target,'utf8')!==bytes)throw Error('Course publication drift: '+path);}else{await mkdir(new URL('./',target),{recursive:true});await writeFile(target,bytes);}}
console.log(JSON.stringify({check,revision,courses:courses.length,profiles:elevation.profiles.length,bytes:Buffer.byteLength(text),remoteMutation:false}));
