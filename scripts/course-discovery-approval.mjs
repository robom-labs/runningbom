import{courseDigest,disciplineKeys,safeCourseURL}from'./course-discovery-core.mjs';
// Deterministic auto-accept policy. This does not publish; unclear assets remain quarantined.
export function approveDiscoveredImages(existing,candidates,races,{baseCourses=[],now=Date.now()}={}){
 const approved=structuredClone(existing),accepted=[],quarantine=[];
 for(const c of candidates){const race=races.find(r=>r.id===c.eventId),e=c.discoveryEvidence,key=disciplineKeys(c.distanceLabel);
  let reason;
  if(c.sourceKind!=='official-image')reason='geometry-requires-separate-source-bound-DEM';
  else if(!race||race.raceDate!==c.raceDate)reason='event-edition-mismatch';
  else if(!e?.editionEvidence?.accepted||e.editionEvidence.raceDate!==c.raceDate||!safeCourseURL(e.pageUrl)||!safeCourseURL(c.imageUrl)||!safeCourseURL(c.sourceUrl))reason='official-exact-edition-proof-required';
  else if(!/^[a-f0-9]{64}$/.test(c.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(e.pageSha256||'')||!e.validatedRaster||!e.explicitCourseDeclaration||e.pageKind!=='course')reason='declared-course-and-validated-raster-required';
  else if(key.length!==1||!disciplineKeys(race.distances).includes(key[0])||e.distanceKey!==key[0]||e.declaredDistanceKeys?.length!==1||e.distanceEvidence!=='explicit-asset-caption-or-filename')reason='explicit-matching-discipline-required';
  else if(e.distanceBasis==='standard-category-nominal'&&(!['Half','Full'].includes(key[0])||e.nominalDistanceKm!==(key[0]==='Half'?21.0975:42.195)||c.officialDistanceKm!==e.nominalDistanceKm||e.distanceIsMeasuredRoute!==false))reason='invalid-image-category-nominal-metadata';
  else if(!Number.isFinite(Date.parse(e.assetCheckedAt))||now-Date.parse(e.assetCheckedAt)>7*86400000||Date.parse(e.assetCheckedAt)>now+300000)reason='asset-proof-expired';
  else if(c.segments?.length||!Number.isFinite(Date.parse(e.pageCheckedAt))||now-Date.parse(e.pageCheckedAt)>7*86400000||Date.parse(e.pageCheckedAt)>now+300000)reason='page-proof-expired-or-image-geometry';
  if(reason){quarantine.push({id:c.id,eventId:c.eventId,url:c.sourceUrl,reason});continue;}
  const same=a=>a.eventId===c.eventId&&a.raceDate===c.raceDate&&JSON.stringify(disciplineKeys(a.distanceLabel))===JSON.stringify(key)&&a.imageUrl===c.imageUrl;
  if(baseCourses.some(same))continue;
  const index=approved.findIndex(same),next={...c,discoveryEvidence:{...e,candidateOnly:false,requiresVisualReview:false,acceptanceRule:'exact-edition-declared-course-explicit-discipline-raster-v1'}};
  if(index>=0){if(approved[index].sourceSha256===c.sourceSha256)continue;next.id=approved[index].id;approved[index]=next;}else approved.push(next);
  accepted.push({id:next.id,eventId:c.eventId,raceDate:c.raceDate,distanceLabel:c.distanceLabel,sourceUrl:c.sourceUrl,sha256:c.sourceSha256});
 }
 return{approved,accepted,quarantine,inputSha256:courseDigest(JSON.stringify(existing)),outputSha256:courseDigest(JSON.stringify(approved)),remoteActivation:false};
}
