import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessOfficialCourseChange} from './course-source-refresh-core.mjs';
const course=JSON.parse(readFileSync(new URL('../apps/mobile/domains/races/course-examples.json',import.meta.url)))[1];
const xml=points=>'<gpx><trk><trkseg>'+points.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>0</ele></trkpt>`).join('')+'</trkseg></trk></gpx>';
const input={pageText:'2026 MBN 서울마라톤 2026.11.15',gpxText:xml(course.segments[0]),checkedAt:'2026-10-23'};
test('official source refresh stages exact edition geometry without deriving fake elevation',()=>{
 const out=assessOfficialCourseChange(course,input);assert.equal(out.geometryChanged,false);assert.equal(out.course.segments[0].length,course.segments[0].length);assert.match(out.course.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(out.course.elevation,undefined);
});
test('official source refresh rejects another year, event, distance and region',()=>{
 for(const change of [{pageText:'2027 MBN 서울마라톤 2027.11.15'},{pageText:'2026 다른대회 2026.11.15'},{gpxText:xml(course.segments[0].slice(0,4))},{gpxText:xml(course.segments[0].map(p=>({...p,lat:p.lat+1})))}])assert.throws(()=>assessOfficialCourseChange(course,{...input,...change}));
});
