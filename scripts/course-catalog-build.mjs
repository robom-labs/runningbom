import{courseCatalogPages}from'./course-source-index-core.mjs';
import{courseDigest}from'./course-discovery-core.mjs';
import{publicElevationProfileProjection}from'./course-elevation-public.mjs';
export{publicElevationProfileProjection}from'./course-elevation-public.mjs';
const publicCourseFields=['id','eventId','eventIds','eventName','raceDate','distanceLabel','officialDistanceKm','sourceKind','sourceUrl','checkedAt','segments','imageUrl','startLabel','endLabel','sourceSha256','notice','sourcePage','reuseStatus'];
/** Collection receipts stay in the private audit registry, not in every APK or
 * WebView boot payload. Source identity, geometry and user-facing caveats stay. */
export function publicCourseProjection(course){return Object.fromEntries(publicCourseFields.filter(key=>course[key]!==undefined).map(key=>[key,course[key]]));}
export function buildCourseCatalog({courses,elevation,index,races,raceBytes,now=Date.now()}){
 if(new Set(courses.map(c=>c.id)).size!==courses.length)throw Error('Duplicate course IDs');
 courses=courses.map(publicCourseProjection);
 elevation={schemaVersion:elevation.schemaVersion,profiles:elevation.profiles.map(publicElevationProfileProjection)};
 const quarantinedPages=[],pages=index?courseCatalogPages(index,races,{now,maxAgeDays:30,raceBytes,onQuarantine:p=>quarantinedPages.push(p)}):[];
 const revision='courses-'+courseDigest(JSON.stringify({courses,elevation,...(index?{pages}:{})})).slice(0,20);
 const times=[...courses,...elevation.profiles,...pages].map(p=>Date.parse(p.checkedAt));if(times.some(t=>!Number.isFinite(t)||t>now+300000))throw Error('Catalog source timestamp invalid');
 const generatedAt=new Date(Math.max(...times)).toISOString(),catalog={schemaVersion:1,revision,generatedAt,courses,elevation,...(index?{pages}:{})},text=JSON.stringify(catalog)+'\n';
 const manifest={schemaVersion:1,revision,generatedAt,count:courses.length,sha256:courseDigest(text),sizeBytes:Buffer.byteLength(text),minimumAppVersion:'0.23.4'};
 return{catalog,text,manifest,manifestText:JSON.stringify(manifest)+'\n',quarantinedPages};
}
