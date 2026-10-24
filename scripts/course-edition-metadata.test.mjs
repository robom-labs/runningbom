import test from 'node:test';import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {garminURL,garminRace,garminPage,garminCourse} from './fixtures/v55-course-edition.mjs';
import {materializeCoursePage,exactCourseEdition,discoverRaceCourseSources,courseDigest,mergeCourseDiscoveryIndex} from './course-discovery-core.mjs';
import {approveDiscoveredImages} from './course-discovery-approval.mjs';
const stamp='2026-10-24T00:00:00.000Z',now=Date.parse(stamp);
const edition=html=>exactCourseEdition(garminRace,materializeCoursePage(html,garminURL));
const receipt=(url,body,type='text/html')=>({ok:true,requestedUrl:url,finalUrl:url,body:Buffer.from(body),sha256:courseDigest(body),contentType:type,checkedAt:stamp});
test('canonical Garmin fixture reproduces body-only date miss; both HEAD descriptions prove exact edition',()=>{
 for(const kind of ['description','og:description']){
  const html=garminPage({kind}),page=materializeCoursePage(html,garminURL);
  assert.doesNotMatch(page.text,/2026-11-15/);
  assert.equal(exactCourseEdition(garminRace,{...page,metadata:undefined}).accepted,false);
  const proof=exactCourseEdition(garminRace,page);
  assert.equal(proof.accepted,true);assert.equal(proof.raceDate,'2026-11-15');assert.equal(proof.metadataKind,kind);assert.equal(proof.method,'official-head-description-exact-date');assert.match(proof.excerpt,/2026-11-15/);
 }
});
test('metadata stays event/date-bound; wrong date/year/name, prefix date and conflicting declarations fail closed',()=>{
 for(const date of ['2025-11-15','2026-11-16','2026-11-150','12026-11-15','12026년 11월 15일','11월 15일'])assert.equal(edition(garminPage({date})).accepted,false,date);
 for(const date of ['2026년 11월 15일','2026.11.15','2026/11/15'])assert.equal(edition(garminPage({date})).accepted,true,date);
 assert.equal(edition(garminPage().replaceAll('가민런 코리아','다른 행사')).accepted,false);
 assert.equal(edition(garminPage().replace('<title>2026','<title>2025')).accepted,false);
 assert.equal(edition(garminPage().replace('</head>','<meta property="og:description" content="2026 가민런 코리아 대회일 2026-11-16"></head>')).reason,'metadata-event-date-conflict');
});
test('head-only, case/entity/relative-canonical parsing is deterministic without fetching canonicals',()=>{
 const html=garminPage({canonical:'/product/18977?comp=18962'}).replace('name="description"','NAME="DeScRiPtIoN"').replace('대회일 ','대회일&#32;');
 assert.equal(edition(html).accepted,true);
 const bodyMeta=garminPage().replace(/<meta[^>]+>/,'').replace('</body>','<meta name="description" content="2026 가민런 코리아 2026-11-15"></body>');
 assert.equal(edition(bodyMeta).accepted,false);
 for(const canonical of ['https://foreign.example/product','https://runable.me/product/other','http://runable.me/product/18977?comp=18962','https://u:p@runable.me/product/18977?comp=18962'])assert.equal(edition(garminPage({canonical})).accepted,false,canonical);
});
test('parser caps reject oversize pages, descriptions and declaration floods rather than accepting truncated evidence',()=>{
 assert.throws(()=>materializeCoursePage('x'.repeat(4000001),garminURL),/parser-byte-budget/);
 assert.equal(edition(garminPage().replace('대회일 ', 'x'.repeat(2049))).reason,'metadata-description-budget');
 assert.equal(edition(garminPage().replace('</head>','<meta name="description" content="x">'.repeat(9)+'</head>')).reason,'metadata-description-budget');
 assert.equal(edition(garminPage().replace('</head>','<meta name="other" content="x">'.repeat(129)+'</head>')).reason,'metadata-node-budget');
});
// Real PNG fixture bytes, never a production image or geometry fixture.
function raster(){const header=Buffer.alloc(13);header.writeUInt32BE(400);header.writeUInt32BE(200,4);header[8]=8;header[9]=2;const chunk=(name,data)=>{const n=Buffer.alloc(4),tag=Buffer.from(name),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);let c=0xffffffff;for(const byte of Buffer.concat([tag,data])){c^=byte;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([n,tag,data,crc]);};return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(240200))),chunk('IEND',Buffer.alloc(0))]);}
async function discover({foreign=false,forged=false}={}){
 const image=raster(),seen=[],get=async url=>{seen.push(url);if(url===garminURL)return {...receipt(url,garminPage()),...(foreign?{finalUrl:'https://foreign.example/'}:{})};if(url==='https://runable.me/course')return receipt(url,garminCourse);const r=receipt(url,image,'image/png');return forged?{...r,sha256:'0'.repeat(64)}:r;};
 return {row:await discoverRaceCourseSources(garminRace,{seeds:[{url:garminURL}],get,now}),seen};
}
test('metadata bootstraps only same-official-scope declared course/images; source SHA and manual Son gates stay intact',async()=>{
 const {row}=await discover();assert.equal(row.candidates.length,1);const c=row.candidates[0];assert.equal(c.raceDate,garminRace.raceDate);assert.equal(c.discoveryEvidence.editionEvidence.method,'same-origin-direct-declaration');
 assert.equal(approveDiscoveredImages([],row.candidates,[garminRace],{now}).accepted.length,1);
 assert.equal((await discover({foreign:true})).row.candidates.length,0);
 assert.equal((await discover({forged:true})).row.candidates.length,0);
 const manualSon={...c,eventId:'manual-son',discoveryEvidence:undefined};
 assert.equal(approveDiscoveredImages([],[manualSon],[{...garminRace,id:'manual-son'}],{now}).accepted.length,0);
});
test('partial future refresh keeps exact-edition page/image receipts unchanged, never new dates or seed scope',async()=>{
 const {row}=await discover(),previous={records:[row]},fresh={...row,resolvedOfficialPages:row.resolvedOfficialPages.slice(0,1),candidates:[],status:'verified-event-page'};
 const merged=mergeCourseDiscoveryIndex(previous,[fresh],[garminRace])[0];assert.deepEqual(merged.resolvedOfficialPages,row.resolvedOfficialPages);
 const accepted=approveDiscoveredImages([],row.candidates,[garminRace],{now}).approved;
 assert.deepEqual(approveDiscoveredImages(accepted,[],[garminRace],{now:now+86400000}).approved,accepted);
 const rollover={...fresh,raceDate:'2027-11-15',resolvedOfficialPages:[]};assert.equal(mergeCourseDiscoveryIndex(previous,[rollover],[{...garminRace,raceDate:rollover.raceDate}])[0].resolvedOfficialPages.length,0);
 assert.equal(mergeCourseDiscoveryIndex(previous,[{...fresh,seedUrls:['https://different.example/'],resolvedOfficialPages:[]}],[garminRace])[0].resolvedOfficialPages.length,0);
});
