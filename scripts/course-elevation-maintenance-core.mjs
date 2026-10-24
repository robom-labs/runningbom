// Pure strict reconstruction of stored qualification. Never refresh timestamps.
import{createHash}from'node:crypto';
import{buildElevationProfile,elevationQueryPoints,elevationRouteGeometry,elevationRouteHash}from'../apps/mobile/assets/course-src/elevation-profile.mjs';
import{parseOfficialGPX,parseElevationResponse,structureMasks,verifyOriginalGPXProfile,originalGPXPolicies}from'./update-course-elevation.mjs';
import{safeCourseURL}from'./course-discovery-core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),DAY=86400000;
export function assertApprovedGeometry(courses){
 if(courses.length>32||new Set(courses.map(c=>c.id)).size!==courses.length)throw Error('Approved GPX batch/identity limit');
 for(const c of courses)if(!c.id||!c.eventId||!/^\d{4}-\d{2}-\d{2}$/.test(c.raceDate||'')||!/^[a-f0-9]{64}$/.test(c.sourceSha256||'')||!safeCourseURL(c.sourceUrl)||!safeCourseURL(c.sourcePage)||!elevationRouteGeometry(c))throw Error('Invalid current approved GPX geometry/provenance');
}
export function qualifyStoredProfile(course,p,envelope,{now=Date.now()}={}){
 const built=buildElevationProfile(course,p);if(!built.available)throw Error('profile-binding:'+built.reason);
 const requests=envelope.retrievalEvidence?.requests;if(!Array.isArray(requests)||requests.length>100)throw Error('missing-bounded-qualification-receipts');
 function receipt(sha,kind,url,{immutable=false}={}){const r=requests.find(r=>r.responseSha256===sha&&r.kind===kind&&r.url===url);const at=Date.parse(r?.checkedAt);if(!r||r.httpStatus!==200||!safeCourseURL(r.url)||typeof r.responseText!=='string'||Buffer.byteLength(r.responseText)>8000000||hash(r.responseText)!==sha||!Number.isFinite(at)||at>now+300000||!immutable&&now-at>30*DAY)throw Error('missing-corrupt-or-expired-'+kind+'-receipt');return r;}
 // Raw official bytes are immutable authenticity evidence, not a DEM cache.
 // Current approved edition/source/hash/geometry and every height still bind.
 if(p.source?.kind==='gpx')return verifyOriginalGPXProfile(course,p,receipt(course.sourceSha256,'official-gpx',course.sourceUrl,{immutable:true}));
 if(p.source?.kind!=='dem'||p.source.provider!=='Open Topo Data'||p.source.dataset!=='srtm30m'||p.source.resolutionM!==30||p.structureMask?.status!=='checked')throw Error('unsupported-or-unqualified-provider');
 const g=receipt(course.sourceSha256,'official-gpx',course.sourceUrl,{immutable:true}),parsed=parseOfficialGPX(g.responseText);
 if(elevationRouteHash(parsed)!==elevationRouteHash(course))throw Error('official-gpx-geometry-mismatch');
 const grid=elevationQueryPoints(course),flat=grid.flat();if(flat.length>3200||p.acquisition?.spacingM!==30||p.acquisition.batchLimit!==100||p.acquisition.gpxResponseSha256!==course.sourceSha256||!Array.isArray(p.acquisition.requestSha256)||p.acquisition.requestSha256.length!==Math.ceil(flat.length/100))throw Error('unsupported-acquisition-binding');
 const dem=[],enriched=[];
 for(let i=0;i<flat.length;i+=100){const points=flat.slice(i,i+100),url='https://api.opentopodata.org/v1/srtm30m?locations='+encodeURIComponent(points.map(p=>`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`).join('|'))+'&interpolation=bilinear&nodata_value=null',r=receipt(p.acquisition.requestSha256[i/100],'dem',url);dem.push(r);enriched.push(...parseElevationResponse(r.responseText,points));}
 let offset=0;const segments=grid.map(s=>{const a=enriched.slice(offset,offset+s.length).map(({distanceM,elevationM})=>({distanceM,elevationM}));offset+=s.length;return a;});if(!same(segments,p.segments))throw Error('profile-samples-not-reconstructed');
 const m=p.structureMask,hashes=m.responseSha256s;if(!Array.isArray(hashes)||!hashes.length||hashes.length>20||m.responseSha256!==hashes[0]||m.proximityM!==35||m.paddingM!==60)throw Error('invalid-structure-qualification');
 let osm,records;
 if(m.endpoint==='https://api.openstreetmap.org/api/0.6/map.json'){
  // Cached historical evidence only: NEVER request this API in maintenance.
  if(!Array.isArray(m.queryUrls)||m.queryUrls.length!==hashes.length)throw Error('missing-structure-queries');
  records=hashes.map((h,i)=>{const u=new URL(m.queryUrls[i]);if(u.origin!== 'https://api.openstreetmap.org'||u.pathname!=='/api/0.6/map.json'||!u.searchParams.get('bbox'))throw Error('structure-endpoint-mismatch');return receipt(h,'osm-map',u.href);});
  const ways=new Map();for(const r of records){const data=JSON.parse(r.responseText);if(data.source!=='osm-api-map'||!Array.isArray(data.elements))throw Error('invalid-cached-structure-representation');for(const w of data.elements)ways.set(w.id,w);}osm={source:'osm-api-map',elements:[...ways.values()]};
 }else if(m.endpoint==='https://overpass-api.de/api/interpreter'){
  if(hashes.length!==1||typeof m.query!=='string')throw Error('invalid-overpass-binding');records=[receipt(hashes[0],'osm-structures',m.endpoint+'?data='+encodeURIComponent(m.query))];osm=JSON.parse(records[0].responseText);
 }else throw Error('unsupported-structure-endpoint');
 const reconstructed=structureMasks(grid,osm);if(!same(reconstructed.masks,p.masks)||reconstructed.wayCount!==m.wayCount)throw Error('structure-masks-not-reconstructed');
 const oldest=a=>a.map(r=>r.checkedAt).sort()[0];if(p.checkedAt!==oldest([g,...dem,...records])||m.checkedAt!==oldest(records))throw Error('qualification-timestamp-mismatch');
 return p;
}
export function retainQualifiedProfiles(courses,previous,{now=Date.now()}={}){
 assertApprovedGeometry(courses);if(previous.schemaVersion!==1||!Array.isArray(previous.profiles))throw Error('Invalid elevation envelope');
 const policies=originalGPXPolicies(previous,courses),protectedIDs=new Set(policies.map(p=>p.courseId));
 const counts=new Map();for(const p of previous.profiles)if(p?.courseId)counts.set(p.courseId,(counts.get(p.courseId)||0)+1);
 const profiles=[],dropped=[];for(const p of previous.profiles){const course=courses.find(c=>c.id===p?.courseId);let reason;
  if(!course)reason='orphan-or-invalid-profile';else if(counts.get(p.courseId)!==1)reason='duplicate-profile';else if(protectedIDs.has(p.courseId)&&p.source?.kind!=='gpx')reason='original-gpx-only-policy-forbids-dem';else try{qualifyStoredProfile(course,p,previous,{now});profiles.push(p);}catch(e){reason=e.message;}
  if(reason)dropped.push({courseId:typeof p?.courseId==='string'?p.courseId:null,reason});
 }
 return{elevation:{...previous,profiles,...(policies.length?{originalGPXPolicies:policies}:{})},dropped,geometryOnly:courses.filter(c=>!profiles.some(p=>p.courseId===c.id)).map(c=>c.id),blockedOriginalGPX:courses.filter(c=>protectedIDs.has(c.id)&&!profiles.some(p=>p.courseId===c.id&&p.source.kind==='gpx')).map(c=>c.id)};
}
