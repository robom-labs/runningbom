import test from'node:test';import assert from'node:assert/strict';import{publicCourseProjection}from'./course-catalog-build.mjs';
test('public course payload retains original route/source/warnings but never private collector paths or page excerpts',()=>{
 const c={id:'c',eventId:'r',raceDate:'2026-11-15',sourceKind:'official-gpx',segments:[[{lat:1,lon:2}]],sourceSha256:'a'.repeat(64),sourceUrl:'https://example.org/a.gpx',sourcePage:'https://example.org/',notice:'공식 도착지 변경 안내를 확인하세요',localEvidenceFile:'/Volumes/private/map',manualProof:{proofFile:'/Users/private/file'},discoveryEvidence:{excerpt:'private collection copy'}};
 const p=publicCourseProjection(c);for(const k of ['segments','sourceSha256','sourceUrl','sourcePage','notice'])assert.deepEqual(p[k],c[k]);
 assert(!JSON.stringify(p).includes('/Volumes/'));assert(!JSON.stringify(p).includes('/Users/'));assert(!('discoveryEvidence'in p));assert(c.manualProof);
});
test('public projection preserves aliases, explicit actual distance and immutable private evidence',()=>{
 const c={id:'image',eventId:'r',eventIds:['r-alias'],officialDistanceKm:20.8,distanceLabel:'하프',sourceKind:'official-image',segments:[],imageUrl:'https://event.example/map.png',notice:'공식 실제거리 20.8km',manualProof:{evidenceFile:'/private/receipt'},discoveryEvidence:{distanceBasis:'official-image-stated',distanceIsMeasuredRoute:false}},before=JSON.stringify(c),p=publicCourseProjection(c);
 assert.equal(p.officialDistanceKm,20.8);assert.deepEqual(p.eventIds,['r-alias']);assert.equal(p.notice,c.notice);assert.equal(JSON.stringify(c),before);assert(!('manualProof'in p));assert(!('discoveryEvidence'in p));
});
