// Bridge NEW discovered official GPX to the EXISTING DEM + OSM masking contract.
// Receipt-driven and pure: no app writes, source guessing, network or publication.
import{parseOfficialGPX,parseElevationResponse,extractOsmStructures,structureMasks}from'./update-course-elevation.mjs';
import{elevationQueryPoints,elevationRouteHash,buildElevationProfile}from'../apps/mobile/assets/course-src/elevation-profile.mjs';
import{courseDigest}from'./course-discovery-core.mjs';
export function discoveredDEMPlan(course){
 if(course.sourceKind!=='official-gpx'||!/^[a-f0-9]{64}$/.test(course.sourceSha256||''))throw Error('New DEM requires a source-verified actual official GPX');
 const grid=elevationQueryPoints(course),flat=grid.flat();if(flat.length>3200)throw Error('Candidate DEM grid exceeds bounded32x100 sample budget');
 const batches=[];for(let i=0;i<flat.length;i+=100){const points=flat.slice(i,i+100),locations=points.map(p=>`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`).join('|');batches.push({points,url:'https://api.opentopodata.org/v1/srtm30m?locations='+encodeURIComponent(locations)+'&interpolation=bilinear&nodata_value=null'});}
 return{courseId:course.id,routeHash:elevationRouteHash(course),grid,batches,sourceGPX:course.sourceUrl,sourceSha256:course.sourceSha256,requiresOSMStructures:true,appWrites:false};
}
function receipt(r){if(!r||typeof r.responseText!=='string'||courseDigest(r.responseText)!==r.responseSha256||!Number.isFinite(Date.parse(r.checkedAt)))throw Error('DEM/OSM/source receipt integrity');return r;}
export function bindDiscoveredDEM(course,{gpx,dem,osm}){
 const plan=discoveredDEMPlan(course),g=receipt(gpx),official=parseOfficialGPX(g.responseText.replace(/<((?:\w+:)?trkpt)\b([^>]*?)\/\s*>/gi,'<$1$2></$1>'));
 if(g.url!==course.sourceUrl||g.responseSha256!==course.sourceSha256||elevationRouteHash(official)!==plan.routeHash)throw Error('Discovered GPX source/geometry changed');
 if(!Array.isArray(dem)||dem.length!==plan.batches.length||!Array.isArray(osm)||!osm.length||osm.length>20)throw Error('Complete bounded DEM/OSM receipts required');
 const enriched=[];for(let i=0;i<dem.length;i++){const r=receipt(dem[i]);if(r.url!==plan.batches[i].url)throw Error('DEM endpoint/query binding');enriched.push(...parseElevationResponse(r.responseText,plan.batches[i].points));}
 const elements=[];for(const r0 of osm){const r=receipt(r0),url=new URL(r.url);if(url.origin!=='https://api.openstreetmap.org'||url.pathname!=='/api/0.6/map.json'||!url.searchParams.get('bbox'))throw Error('OSM source binding');elements.push(...JSON.parse(extractOsmStructures(r.responseText)).elements);}
 const {masks,wayCount}=structureMasks(plan.grid,{source:'osm-api-map',elements});let offset=0;
 const segments=plan.grid.map(line=>{const samples=enriched.slice(offset,offset+line.length).map(({distanceM,elevationM})=>({distanceM,elevationM}));offset+=line.length;return samples;});
 const checkedAt=[g,...dem,...osm].map(r=>r.checkedAt).sort()[0];
 const profile={schemaVersion:1,courseId:course.id,eventId:course.eventId,raceDate:course.raceDate,routeHash:plan.routeHash,officialGPXsha:course.sourceSha256,officialGPXUrl:course.sourceUrl,checkedAt,
  source:{kind:'dem',provider:'Open Topo Data',dataset:'srtm30m',resolutionM:30,verticalDatum:'EGM96',interpolation:'bilinear',attribution:'NASA/USGS SRTM · Open Topo Data · © OpenStreetMap contributors (ODbL)',license:'SRTM: public domain; OSM-derived structure masks: ODbL 1.0',urls:['https://www.opentopodata.org/api/','https://www.openstreetmap.org/copyright'],estimated:true},
  officialGPXEvidence:{elevationCount:official.elevationCount,validElevationCount:official.validElevationCount,allZeroPlaceholder:official.allZeroPlaceholder,decision:'existing-source-bound-DEM-pipeline; never substitute zero GPX placeholders'},
  structureMask:{status:'checked',provider:'OpenStreetMap original read API',endpoint:'https://api.openstreetmap.org/api/0.6/map.json',checkedAt:osm.map(r=>r.checkedAt).sort()[0],responseSha256:osm[0].responseSha256,responseSha256s:osm.map(r=>r.responseSha256),queryUrls:osm.map(r=>r.url),wayCount,proximityM:35,paddingM:60},masks,segments};
 const built=buildElevationProfile(course,profile);if(!built.available)throw Error('Existing native DEM contract rejected discovered GPX: '+built.reason);return{profile,contract:built,appWrites:false};
}
