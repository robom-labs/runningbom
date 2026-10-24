#!/usr/bin/env node
/** Offline build-time enrichment only. No accounts, keys, paid services or runtime calls. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildElevationProfile,elevationQueryPoints,elevationRouteGeometry,elevationRouteHash} from '../apps/mobile/assets/course-src/elevation-profile.mjs';
import{readCourseBase,readCourseElevation}from'./course-metadata-inputs.mjs';

const OUTPUT=new URL('../data/course-elevation.json',import.meta.url);
const DATASET='srtm30m',DEM='https://api.opentopodata.org/v1/srtm30m';
const OVERPASS='https://overpass-api.de/api/interpreter';
const hash=text=>createHash('sha256').update(text).digest('hex');
const CACHE_MS=30*86400000;

// Persistent provenance policy, not a freshness certificate. Never re-date it.
// Even rejected/deleted original profiles must not silently enter DEM next run.
export function originalGPXPolicies(envelope,courses){
 const rows=envelope.originalGPXPolicies??[];
 if(!Array.isArray(rows)||rows.length>128||rows.some(p=>!p||typeof p.courseId!=='string'||!p.courseId||p.mode!=='original-gpx-only')||new Set(rows.map(p=>p.courseId)).size!==rows.length)throw Error('Invalid original GPX policy registry');
 const map=new Map(rows.map(p=>[p.courseId,p]));
 const protect=id=>{if(courses.some(c=>c.id===id)&&!map.has(id))map.set(id,{courseId:id,mode:'original-gpx-only'});};
 for(const p of envelope.profiles??[])if(p?.source?.kind==='gpx'||p?.officialGPXEvidence?.originalReceipt)protect(p.courseId);
 for(const r of envelope.retrievalEvidence?.requests??[])if(r?.kind==='official-gpx'&&/^[a-f0-9]{64}$/.test(r.originalReceiptFileSHA256||''))for(const c of courses)if(c.sourceUrl===r.url)protect(c.id);
 if(map.size>128)throw Error('Original GPX policy registry budget');return[...map.values()];
}

/** Strict result count, order, coordinates and dataset; null stays null, never Number(null). */
export function parseElevationResponse(text,points) {
  const data=JSON.parse(text);
  if(data.status!=='OK'||!Array.isArray(data.results)||data.results.length!==points.length)throw Error('DEM status/result-count mismatch');
  return data.results.map((r,i)=>{
    const p=points[i];
    if(!Number.isFinite(r.location?.lat)||!Number.isFinite(r.location?.lng)||Math.abs(r.location.lat-p.lat)>1e-6||Math.abs(r.location.lng-p.lon)>1e-6||r.dataset!==DATASET)throw Error('DEM dataset/coordinate mismatch');
    if(r.elevation!==null&&(!Number.isFinite(r.elevation)||r.elevation< -500||r.elevation>9000))throw Error('DEM elevation out of bounds');
    return {...p,elevationM:r.elevation};
  });
}
export function parseOfficialGPX(text) {
  if(text.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(text)||!/<(?:\w+:)?gpx\b/i.test(text))throw Error('Invalid official GPX');
  const segments=[],elevations=[];
  for(const block of text.matchAll(/<(?:\w+:)?trkseg\b[^>]*>([\s\S]*?)<\/(?:\w+:)?trkseg\s*>/gi)){
    const segment=[];
    for(const match of block[1].matchAll(/<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt\s*>/gi)){
      const lat=match[1].match(/\blat\s*=\s*["']([^"']+)["']/i),lon=match[1].match(/\blon\s*=\s*["']([^"']+)["']/i);
      if(!lat||!lon||!lat[1].trim()||!lon[1].trim())throw Error('GPX coordinate missing');
      segment.push({lat:Number(lat[1]),lon:Number(lon[1])});
      const ele=match[2].match(/<(?:\w+:)?ele\b[^>]*>([^<]*)<\/(?:\w+:)?ele\s*>/i);
      elevations.push(ele&&ele[1].trim()?Number(ele[1]):null);
    }
    segments.push(segment);
  }
  if(!elevationRouteGeometry({segments}))throw Error('GPX geometry invalid');
  return {segments,elevationCount:elevations.length,validElevationCount:elevations.filter(Number.isFinite).length,allZeroPlaceholder:elevations.length>0&&elevations.every(v=>v===0)};
}

/** Original GPX heights only: retain source order, mixed zero values and invalid gaps.
 * Equal-distance conflicts cannot be averaged/selected for the strict chart axis. */
export function originalGPXSamples(text) {
  const official=parseOfficialGPX(text),geometry=elevationRouteGeometry(official),segments=[];
  let segmentIndex=0,rawSampleCount=0,validElevationCount=0;
  const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  for(const block of text.matchAll(/<(?:\w+:)?trkseg\b[^>]*>([\s\S]*?)<\/(?:\w+:)?trkseg\s*>/gi)){
    const line=[];let originalIndex=0;
    for(const m of block[1].matchAll(/<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt\s*>/gi)){
      const raw=m[2].match(/<(?:\w+:)?ele\b[^>]*>([^<]*)<\/(?:\w+:)?ele\s*>/i)?.[1]??null;
      const value=raw!==null&&decimal.test(raw.trim())?Number(raw):null;
      const valid=Number.isFinite(value)&&value>=-500&&value<=9000;
      const point=geometry.segments[segmentIndex][originalIndex++];
      line.push({...point,elevationM:valid?value:null,valid,originalIndex:originalIndex-1});
      rawSampleCount++;if(valid)validElevationCount++;
    }
    const groups=[];
    for(const point of line){const last=groups.at(-1);if(last?.distanceM===point.distanceM)last.push(point);else{const group=[point];group.distanceM=point.distanceM;groups.push(group);}}
    segments.push(groups.map(group=>{
      const first=group[0],invalid=group.some(p=>!p.valid),conflict=group.some(p=>p.elevationM!==first.elevationM),valid=!invalid&&!conflict;
      return {distanceM:first.distanceM,lat:first.lat,lon:first.lon,elevationM:valid?first.elevationM:null,valid,originalIndices:group.map(p=>p.originalIndex),invalidReason:invalid?'source-invalid-at-this-distance':conflict?'conflicting-heights-at-identical-distance':null};
    }));segmentIndex++;
  }
  if(rawSampleCount!==[...text.matchAll(/<(?:\w+:)?trkpt\b/gi)].length)throw Error('Original GPX omitted points');
  const spacing=geometry.segments.flatMap(line=>line.slice(1).map((p,i)=>p.distanceM-line[i].distanceM)).filter(d=>d>0);
  const resolutionM=spacing.reduce((sum,d)=>sum+d,0)/spacing.length;
  const masks=segments.flatMap((line,segmentIndex)=>line.filter(p=>!p.valid).map(p=>({segmentIndex,startM:p.distanceM,endM:p.distanceM,reason:p.invalidReason})));
  return {official,segments,masks,resolutionM,rawSampleCount,validElevationCount};
}
/** Verifies the cached raw body, edition, coordinates AND every actual height.
 * No DEM/OSM acquisition or inferred vertical-accuracy metadata is allowed. */
export function verifyOriginalGPXProfile(course,profile,receipt) {
  if(profile?.source?.kind!=='gpx'||receipt?.kind!=='official-gpx'||receipt.httpStatus!==200||typeof receipt.responseText!=='string'||receipt.url!==course.sourceUrl||receipt.responseSha256!==course.sourceSha256||hash(receipt.responseText)!==course.sourceSha256||profile.checkedAt!==receipt.checkedAt)throw Error('Original GPX receipt/source binding mismatch');
  const source=originalGPXSamples(receipt.responseText);
  if(elevationRouteHash(source.official)!==elevationRouteHash(course))throw Error('Original GPX coordinate/order mismatch');
  if(JSON.stringify(profile.segments)!==JSON.stringify(source.segments)||JSON.stringify(profile.masks)!==JSON.stringify(source.masks)||profile.source.resolutionM!==source.resolutionM)throw Error('Original GPX height/gap/spacing reconstruction mismatch');
  if(profile.source.estimated!==false||profile.source.verticalPrecision!=='unknown; source does not establish accuracy'||profile.source.verticalDatum!=='unknown; not stated by source'||profile.source.resolutionMeaning!=='calculated mean positive horizontal spacing between original consecutive coordinates; NOT vertical accuracy or DEM resolution'||profile.source.accuracyM!==undefined||profile.source.interpolation!==undefined)throw Error('Original GPX provenance must not assert DEM or vertical accuracy');
  const evidence=profile.officialGPXEvidence;
  if(evidence?.responseSha256!==receipt.responseSha256||evidence.rawSampleCount!==source.rawSampleCount||evidence.validElevationCount!==source.validElevationCount||evidence.allZeroPlaceholder!==source.official.allZeroPlaceholder)throw Error('Original GPX evidence count/hash mismatch');
  if(evidence.originalReceipt?.url!==receipt.url||evidence.originalReceipt?.responseSha256!==receipt.responseSha256||evidence.originalReceipt?.checkedAt!==receipt.checkedAt||evidence.originalReceiptFile?.sha256!==receipt.originalReceiptFileSHA256||receipt.bytes!==Buffer.byteLength(receipt.responseText))throw Error('Original GPX original receipt metadata mismatch');
  const built=buildElevationProfile(course,profile);if(!built.available)throw Error('Original GPX profile invalid: '+built.reason);
  return profile;
}

/** Local equirectangular distance is used ONLY for the conservative structure mask. */
function pointLineDistance(p,a,b) {
  const k=6371008.8*Math.PI/180,c=Math.cos(p.lat*Math.PI/180);
  const ax=(a.lon-p.lon)*k*c,ay=(a.lat-p.lat)*k,bx=(b.lon-p.lon)*k*c,by=(b.lat-p.lat)*k;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(ax+t*dx,ay+t*dy);
}
export function structureMasks(segments,osm) {
  if(osm.remark||!Array.isArray(osm.elements)||(!osm.osm3s?.timestamp_osm_base&&osm.source!=='osm-api-map'))throw Error('Incomplete OSM response');
  const ways=osm.elements.filter(w=>w.type==='way'&&w.tags?.highway&&((w.tags.bridge&&w.tags.bridge!=='no')||(w.tags.tunnel&&w.tags.tunnel!=='no')));
  if(ways.some(w=>!Array.isArray(w.geometry)||w.geometry.length<2||w.geometry.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon))))throw Error('Overpass geometry missing');
  const masks=[];
  for(let segmentIndex=0;segmentIndex<segments.length;segmentIndex++){
    const segment=segments[segmentIndex],intervals=[];
    for(const p of segment){
      const hits=ways.filter(w=>w.geometry.some((b,i)=>i&&pointLineDistance(p,w.geometry[i-1],b)<=35));
      if(hits.length)intervals.push({segmentIndex,startM:Math.max(segment[0].distanceM,p.distanceM-60),endM:Math.min(segment.at(-1).distanceM,p.distanceM+60),reason:'osm-bridge-tunnel-proximity',osmWayIds:hits.map(w=>w.id)});
    }
    for(const next of intervals){
      const last=masks.at(-1);
      if(last&&last.segmentIndex===segmentIndex&&next.startM<=last.endM){last.endM=Math.max(last.endM,next.endM);last.osmWayIds=[...new Set([...last.osmWayIds,...next.osmWayIds])].sort((a,b)=>a-b);}
      else masks.push(next);
    }
  }
  return {masks,wayCount:ways.length};
}

/** Keep only public structure geometry in cache, not unrelated OSM editor/user metadata. */
export function extractOsmStructures(text) {
  const data=JSON.parse(text);
  if(!Array.isArray(data.elements)||!data.bounds||!data.license)throw Error('Incomplete OSM map response');
  const nodes=new Map(data.elements.filter(e=>e.type==='node').map(n=>[n.id,n]));
  const elements=data.elements.filter(w=>w.type==='way'&&w.tags?.highway&&((w.tags.bridge&&w.tags.bridge!=='no')||(w.tags.tunnel&&w.tags.tunnel!=='no'))).map(w=>{
    const geometry=w.nodes.map(id=>{const p=nodes.get(id);if(!p)throw Error('Incomplete OSM way nodes');return {lat:p.lat,lon:p.lon};});
    return {type:'way',id:w.id,version:w.version,timestamp:w.timestamp,tags:w.tags,geometry};
  });
  return JSON.stringify({source:'osm-api-map',license:data.license,bounds:data.bounds,elements});
}
function mapQueryUrls(grids) {
  const urls=new Set();
  for(const grid of grids.flat()){
    // At most ~2 km of route per request; 16 small areas, no regional scrape.
    const groups=new Map();
    for(const p of grid){const key=Math.floor((p.distanceM-grid[0].distanceM)/2000);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
    for(const ps of groups.values()){
      const box=[Math.min(...ps.map(p=>p.lon))-.001,Math.min(...ps.map(p=>p.lat))-.001,Math.max(...ps.map(p=>p.lon))+.001,Math.max(...ps.map(p=>p.lat))+.001].map(v=>v.toFixed(6)).join(',');
      urls.add(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${box}`);
    }
  }
  if(urls.size>20)throw Error('OSM map request budget exceeded');
  return [...urls];
}

async function boundedBody(response) {
  if(Number(response.headers.get('content-length'))>8_000_000)throw Error('Response too large');
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>8_000_000)throw Error('Response too large');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
export function createRetriever(previous=[],{offline=false,refresh=false,fetchImpl=fetch,now=()=>Date.now(),sleep=delay}={}) {
  const evidence=[],attempts=[];let lastRequest=0,totalAttempts=0;
  async function get(url,kind) {
    const cached=previous.find(r=>r.url===url&&r.httpStatus===200&&r.responseSha256===hash(r.responseText??'')&&Date.parse(r.checkedAt)<=now()&&now()-Date.parse(r.checkedAt)<CACHE_MS);
    if(cached&&!refresh){evidence.push(cached);return cached;}
    if(offline)throw Error(`Offline cache miss: ${kind}`);
    for(let attempt=1;attempt<=3;attempt++){
      if(++totalAttempts>50)throw Error('Global network request budget exhausted');
      await sleep(Math.max(0,1150-(now()-lastRequest)));lastRequest=now();
      const checkedAt=new Date(now()).toISOString();
      try{
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'Runningbom-v53-elevation-build/1.0 (offline course enrichment)','Accept':kind==='official-gpx'?'application/gpx+xml,application/xml':'application/json'}});
        let responseText=await boundedBody(response);
        attempts.push({url,attempt,checkedAt,httpStatus:response.status});
        if(!response.ok){if(response.status!==429&&response.status<500)throw Object.assign(Error(`HTTP ${response.status}`),{permanent:true});throw Error(`HTTP ${response.status}`);}
        const originalResponseSha256=hash(responseText),originalResponseBytes=Buffer.byteLength(responseText);
        if(kind==='osm-map')responseText=extractOsmStructures(responseText);
        const record={url,kind,checkedAt,httpStatus:response.status,responseSha256:hash(responseText),...(kind==='osm-map'?{originalResponseSha256,originalResponseBytes,responseRepresentation:'structure-only-derived-json'}:{}),responseText};evidence.push(record);return record;
      }catch(error){
        if(!attempts.some(a=>a.url===url&&a.attempt===attempt))attempts.push({url,attempt,checkedAt,error:error.name??'Error'});
        if(error.permanent||attempt===3)throw Error(`${kind}: ${error.message}`,{cause:error});
        await sleep(attempt*2000);
      }
    }
  }
  return {get,evidence,attempts};
}

export async function updateCourseElevation(args=process.argv.slice(2)) {
  if(args.some(a=>!['--offline','--refresh','--stdout','--osm-api','--overpass-only','--check'].includes(a)))throw Error('Options: --offline, --refresh, --stdout, --osm-api, --overpass-only, --check');
  if(args.includes('--overpass-only')&&args.includes('--osm-api'))throw Error('Conflicting structure provider policy');
  const checking=args.includes('--check');
  if((args.includes('--offline')||checking)&&args.includes('--refresh'))throw Error('offline/check and refresh are mutually exclusive');
  if(checking&&args.includes('--stdout'))throw Error('--check prints a short summary only; do not combine with --stdout');
  let courses=(await readCourseBase()).courses.filter(c=>c.sourceKind==='official-gpx');
  if(!courses.length||new Set(courses.map(c=>c.id)).size!==courses.length||courses.some(c=>!c.id||!c.eventId||!/^\d{4}-\d{2}-\d{2}$/.test(c.raceDate??'')||!/^https:\/\//.test(c.sourceUrl??'')||!c.sourcePage||!c.checkedAt||!c.reuseStatus||!/^[a-f0-9]{64}$/.test(c.sourceSha256??'')||!elevationRouteGeometry(c)))throw Error('Approved official-GPX rows need unique IDs, edition, provenance, HTTPS URL, source SHA and valid geometry');
  let previous;try{previous=(await readCourseElevation()).elevation;}catch(error){if(error.code!=='ENOENT')throw error;previous={};}
  const originalOnly=new Set(originalGPXPolicies(previous,courses).map(p=>p.courseId));
  if(previous.profiles?.some(p=>originalOnly.has(p?.courseId)&&p.source?.kind!=='gpx'))throw Error('Original GPX policy forbids implicit DEM conversion');
  const geometryOnly=[];
  if(checking){
    if(previous.schemaVersion!==1||!Array.isArray(previous.profiles))throw Error('Cached enrichment schema missing or invalid');
    if(previous.profiles.some(p=>!p?.courseId||!courses.some(c=>c.id===p.courseId))||new Set(previous.profiles.map(p=>p.courseId)).size!==previous.profiles.length)throw Error('Orphan or duplicate cached elevation profile');
    geometryOnly.push(...courses.filter(c=>!previous.profiles.some(p=>p.courseId===c.id)).map(c=>c.id));
    courses=courses.filter(c=>previous.profiles.some(p=>p.courseId===c.id));
    for(const c of courses){const p=buildElevationProfile(c,previous.profiles.find(p=>p.courseId===c.id));if(!p.available)throw Error(`${c.id}: cached binding rejected: ${p.reason}`);}
    if(!courses.length){console.log(JSON.stringify({ok:true,offline:true,rewritten:false,profiles:[],geometryOnly}));return previous;}
  }
  const originalProfiles=[];
  for(const course of courses){const profile=previous.profiles.find(p=>p.courseId===course.id);if(profile?.source?.kind!=='gpx')continue;
    const receipt=previous.retrievalEvidence?.requests?.find(r=>r.kind==='official-gpx'&&r.url===course.sourceUrl);
    originalProfiles.push(verifyOriginalGPXProfile(course,profile,receipt));
  }
  courses=courses.filter(c=>!originalOnly.has(c.id)&&!originalProfiles.some(p=>p.courseId===c.id));
  if(!courses.length){if(checking)console.log(JSON.stringify({ok:true,offline:true,rewritten:false,geometryOnly,profiles:originalProfiles.map(p=>({courseId:p.courseId,kind:'gpx'}))}));else if(args.includes('--stdout'))process.stdout.write(JSON.stringify(previous,null,2)+'\n');return previous;}
  const retrieval=createRetriever(previous.retrievalEvidence?.requests??[],{offline:checking||args.includes('--offline'),refresh:args.includes('--refresh')});
  const grids=courses.map(c=>elevationQueryPoints(c)),all=courses.flatMap(c=>c.segments.flat());
  const bbox=[Math.min(...all.map(p=>p.lat))-.002,Math.min(...all.map(p=>p.lon))-.002,Math.max(...all.map(p=>p.lat))+.002,Math.max(...all.map(p=>p.lon))+.002].map(v=>v.toFixed(6)).join(',');
  const query=`[out:json][timeout:20][maxsize:16777216];(way[highway][bridge][bridge!=no](${bbox});way[highway][tunnel][tunnel!=no](${bbox}););out tags geom;`;
  const useMap=!args.includes('--overpass-only')&&(args.includes('--osm-api')||previous.retrievalEvidence?.requests?.some(r=>r.kind==='osm-map'));
  const osmRecords=[];let osm;
  if(useMap){
    const ways=new Map();
    for(const url of mapQueryUrls(grids)){
      const record=await retrieval.get(url,'osm-map');osmRecords.push(record);
      for(const w of JSON.parse(record.responseText).elements)ways.set(w.id,w);
    }
    osm={source:'osm-api-map',elements:[...ways.values()]};
  }else{
    const record=await retrieval.get(`${OVERPASS}?data=${encodeURIComponent(query)}`,'osm-structures');osmRecords.push(record);osm=JSON.parse(record.responseText);
  }
  const profiles=[];
  for(let c=0;c<courses.length;c++){
    const course=courses[c],grid=grids[c],gpxRecord=await retrieval.get(course.sourceUrl,'official-gpx'),official=parseOfficialGPX(gpxRecord.responseText);
    if(gpxRecord.responseSha256!==course.sourceSha256||elevationRouteHash({segments:official.segments})!==elevationRouteHash(course))throw Error(`${course.id}: official GPX changed; rebuild/review route first`);
    const flat=grid.flat(),enriched=[],demEvidence=[];
    for(let i=0;i<flat.length;i+=100){
      const points=flat.slice(i,i+100);
      const locations=points.map(p=>`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`).join('|');
      const url=`${DEM}?locations=${encodeURIComponent(locations)}&interpolation=bilinear&nodata_value=null`;
      const record=await retrieval.get(url,'dem');demEvidence.push(record);
      enriched.push(...parseElevationResponse(record.responseText,points));
    }
    let offset=0;const segments=grid.map(s=>{const result=enriched.slice(offset,offset+s.length).map(({distanceM,elevationM})=>({distanceM,elevationM}));offset+=s.length;return result;});
    const {masks,wayCount}=structureMasks(grid,osm);
    const checkedAt=[...osmRecords,gpxRecord,...demEvidence].map(r=>r.checkedAt).sort()[0]; // oldest component, never rejuvenate cache age
    const profile={schemaVersion:1,courseId:course.id,eventId:course.eventId,raceDate:course.raceDate,routeHash:elevationRouteHash(course),officialGPXsha:gpxRecord.responseSha256,officialGPXUrl:course.sourceUrl,checkedAt,
      source:{kind:'dem',provider:'Open Topo Data',dataset:DATASET,resolutionM:30,verticalDatum:'EGM96',interpolation:'bilinear',attribution:'NASA/USGS SRTM · Open Topo Data · © OpenStreetMap contributors (ODbL)',license:'SRTM: public domain; OSM-derived structure masks: ODbL 1.0',urls:['https://www.opentopodata.org/','https://www.opentopodata.org/api/','https://www.opentopodata.org/datasets/srtm/','https://doi.org/10.5066/F7PR7TFT','https://www.openstreetmap.org/copyright','https://opendatacommons.org/licenses/odbl/1-0/'],estimated:true},
      officialGPXEvidence:{elevationCount:official.elevationCount,validElevationCount:official.validElevationCount,allZeroPlaceholder:official.allZeroPlaceholder,decision:official.allZeroPlaceholder?'discard-placeholder-use-dem':'use-dem-not-gpx-elevation'},
      acquisition:{spacingM:30,batchLimit:100,requestSha256:demEvidence.map(r=>r.responseSha256),gpxResponseSha256:gpxRecord.responseSha256},
      structureMask:{status:'checked',provider:useMap?'OpenStreetMap original read API':'OpenStreetMap via Overpass',endpoint:useMap?'https://api.openstreetmap.org/api/0.6/map.json':OVERPASS,checkedAt:osmRecords.map(r=>r.checkedAt).sort()[0],osmTimestamp:osm.osm3s?.timestamp_osm_base??null,responseSha256:osmRecords[0].responseSha256,responseSha256s:osmRecords.map(r=>r.responseSha256),...(useMap?{queryUrls:osmRecords.map(r=>r.url)}:{query}),wayCount,proximityM:35,paddingM:60,limitation:'Conservative 2D proximity, not deck-height or lane matching; incomplete tags and false positives possible.'},
      masks,segments};
    const built=buildElevationProfile(course,profile);
    if(!built.available)throw Error(`${course.id}: generated profile rejected: ${built.reason}`);
    profiles.push(profile);
    if(!checking)console.error(JSON.stringify({courseId:course.id,lengthM:built.lengthM,rawSamples:flat.length,rawMinM:Math.min(...enriched.filter(p=>p.elevationM!==null).map(p=>p.elevationM)),rawMaxM:Math.max(...enriched.filter(p=>p.elevationM!==null).map(p=>p.elevationM)),minElevationM:built.minElevationM,maxElevationM:built.maxElevationM,validSamples:built.segments.flat().length,runs:built.segments.length,masks:masks.length,maskedM:masks.reduce((n,m)=>n+m.endM-m.startM,0),numericGrades:built.segments.flat().filter(p=>p.gradePercent!==null).length,officialGPX:profile.officialGPXEvidence}));
  }
  profiles.push(...originalProfiles);
  const orderedProfiles=previous.profiles.filter(p=>profiles.some(n=>n.courseId===p.courseId)).map(p=>profiles.find(n=>n.courseId===p.courseId));
  for(const p of profiles)if(!orderedProfiles.some(n=>n.courseId===p.courseId))orderedProfiles.push(p);
  const requests=[...(previous.retrievalEvidence?.requests??[])];for(const r of retrieval.evidence){const i=requests.findIndex(p=>p.url===r.url&&p.kind===r.kind);if(i<0)requests.push(r);else requests[i]=r;}
  const result={...previous,schemaVersion:1,profiles:orderedProfiles,retrievalEvidence:{...previous.retrievalEvidence,cacheMaxAgeDays:30,requestTimeoutMs:25000,maxAttemptsPerRequest:3,maxNetworkAttempts:50,minRequestIntervalMs:1150,requests,attempts:[...(previous.retrievalEvidence?.attempts??[]),...retrieval.attempts]}};
  if(checking){
    if(JSON.stringify(previous.profiles)!==JSON.stringify(orderedProfiles))throw Error('Cached profiles differ from reconstruction of content-hashed source receipts');
    console.log(JSON.stringify({ok:true,offline:true,rewritten:false,geometryOnly,profiles:profiles.map(p=>({courseId:p.courseId,eventId:p.eventId,raceDate:p.raceDate,routeHash:p.routeHash}))}));
    return result;
  }
  const json=JSON.stringify(result,null,2)+'\n';
  // No writes until every source, binding and generated profile has passed validation.
  if(args.includes('--stdout'))process.stdout.write(json);else await writeFile(OUTPUT,json,'utf8');
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))updateCourseElevation().catch(error=>{console.error(error.message);process.exitCode=1;});
