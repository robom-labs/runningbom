import{readFile}from'node:fs/promises';
const defaultRoot=new URL('../',import.meta.url);
// Only absence permits legacy fallback. Corrupt, unreadable or invalid metadata
// must fail closed rather than silently resurrect an old app/bundled record.
async function preferredJSON(root,preferred,legacy){
 const url=new URL(preferred,root);let text;
 try{text=await readFile(url,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;const fallback=new URL(legacy,root);return{value:JSON.parse(await readFile(fallback,'utf8')),url:fallback,preferred:false};}
 return{value:JSON.parse(text),url,preferred:true};
}
export async function readCourseBase(root=defaultRoot){
 const input=await preferredJSON(root,'data/course-base.json','apps/mobile/domains/races/course-examples.json');
 if(!Array.isArray(input.value)||!input.value.length||new Set(input.value.map(c=>c.id)).size!==input.value.length)throw Error('Course base metadata must be a nonempty unique course array');
 return{courses:input.value,url:input.url,preferred:input.preferred,writeURL:new URL('data/course-base.json',root)};
}
export async function readCourseElevation(root=defaultRoot){
 const input=await preferredJSON(root,'data/course-elevation.json','apps/mobile/domains/races/course-elevation.json');
 if(input.value?.schemaVersion!==1||!Array.isArray(input.value.profiles))throw Error('Course elevation metadata schema');
 return{elevation:input.value,url:input.url,preferred:input.preferred,writeURL:new URL('data/course-elevation.json',root)};
}
