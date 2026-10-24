// Runtime whitelist: original GPX bodies and collector receipts stay private.
// Existing DEM profiles remain exactly as reviewed.
export function publicElevationProfileProjection(profile){
 if(profile?.source?.kind!=='gpx')return profile;
 const fields=['schemaVersion','courseId','eventId','raceDate','routeHash','officialGPXsha','officialGPXUrl','checkedAt','source','segments','masks','structureMask','notice','finishWarning'];
 const output=Object.fromEntries(fields.filter(key=>profile[key]!==undefined).map(key=>[key,profile[key]]));
 const sourceFields=['kind','provider','dataset','resolutionM','resolutionMeaning','horizontalSpacingStatistic','verticalDatum','verticalPrecision','attribution','license','urls','estimated'];
 output.source=Object.fromEntries(sourceFields.filter(key=>profile.source[key]!==undefined).map(key=>[key,profile.source[key]]));
 output.segments=profile.segments.map(line=>line.map(({distanceM,elevationM,valid})=>({distanceM,elevationM,valid})));
 return output;
}
