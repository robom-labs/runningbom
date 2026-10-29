// Generate/check remote course data locally. This script does NOT deploy or push.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import{buildCourseCatalog}from'./course-catalog-build.mjs';
import{readCourseElevation}from'./course-metadata-inputs.mjs';
import{readApprovedCourses,verifyCoursePair}from'./course-data-publication.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const courses=await readApprovedCourses(undefined,undefined,{root}),raw=(await readCourseElevation(root)).elevation;
if(new Set(courses.map(c=>c.id)).size!==courses.length)throw Error('Duplicate course IDs');
const elevation={schemaVersion:1,profiles:raw.profiles};
const [index,raceBytes]=await Promise.all([read('data/course-source-index.json'),readFile(new URL('apps/mobile/src/data/races.json',root))]);
const races=JSON.parse(raceBytes);
const built=buildCourseCatalog({courses,elevation,index,races:races.races,raceBytes});
// Validate all geometry and every supplied profile before ANY output writes.
const verification=verifyCoursePair(built.text,built.manifest,{approvedCourses:courses});
const{revision,generatedAt}=built.catalog;
// The same app-side contract is run by tests before deployment/installation.
const text=built.text,manifest=built.manifestText;
const check=process.argv.includes('--check');
// A clean checkout has no generated preview directory. Remote-only checking
// validates the authoritative pair; generation and non-remote checks retain previews.
const files=[...(!process.argv.includes('--remote-only')?[['apps/mobile/domains/races/course-catalog.json',text]]:[]),['data/course-catalog.json',text],['data/course-catalog.manifest.json',manifest],...(!check||!process.argv.includes('--remote-only')?[['outputs/pushrun-site/data/course-catalog.json',text],['outputs/pushrun-site/data/course-catalog.manifest.json',manifest]]:[])];
for(const [path,bytes] of files){const target=new URL(path,root);if(check){if(await readFile(target,'utf8')!==bytes)throw Error('Course publication drift: '+path);}else{await mkdir(new URL('./',target),{recursive:true});await writeFile(target,bytes);}}
console.log(JSON.stringify({check,revision,courses:courses.length,pages:built.catalog.pages.length,quarantinedPages:built.quarantinedPages,profiles:elevation.profiles.length,geometryOnlyGPX:verification.geometryOnlyGPX,bytes:Buffer.byteLength(text),remoteMutation:false}));
