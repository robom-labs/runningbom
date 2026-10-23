import {parseOfficialGPX} from './update-course-elevation.mjs';
import {elevationRouteGeometry,elevationRouteHash} from '../apps/mobile/assets/course-src/elevation-profile.mjs';
import {createHash} from 'node:crypto';
// Existing approved official endpoint only. No route finding, AI, image tracing,
// cross-edition reuse, or whole-web discovery is treated as authority.
export function assessOfficialCourseChange(course,{pageText,gpxText,checkedAt}){
 const [year,month,day]=course.raceDate.split('-').map(Number);
 const title=pageText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'';
 if([...title.matchAll(/20\d{2}/g)].some(m=>Number(m[0])!==year))throw Error('Official source title edition conflict');
 pageText=pageText.replace(/<(script|style|noscript|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ');
 const date=new RegExp(`${year}\\s*(?:년|[./-])\\s*0?${month}\\s*(?:월|[./-])\\s*0?${day}(?!\\d)`);
 const normal=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const tokens=course.eventName.replace(/20\d{2}|마라톤|대회|국제|전국/g,' ').split(/[\s,()&-]+/).map(normal).filter(s=>s.length>=2);
 if(!date.test(pageText)||!tokens.some(s=>normal(pageText).includes(s)))throw Error('Exact official edition not re-established');
 const parsed=parseOfficialGPX(gpxText),geometry=elevationRouteGeometry(parsed);
 if(!geometry||Math.abs(geometry.lengthM/1000-course.officialDistanceKm)>Math.max(.15,course.officialDistanceKm*.03))throw Error('Official course distance changed beyond automatic budget');
 const old=course.segments.flat(),next=parsed.segments.flat();
 const bounds=points=>({minLat:Math.min(...points.map(p=>p.lat)),maxLat:Math.max(...points.map(p=>p.lat)),minLon:Math.min(...points.map(p=>p.lon)),maxLon:Math.max(...points.map(p=>p.lon))});
 const a=bounds(old),b=bounds(next);
 if(Object.keys(a).some(key=>Math.abs(a[key]-b[key])>.03))throw Error('Official course moved outside approved area');
 const sha=createHash('sha256').update(gpxText).digest('hex');
 return {course:{...course,segments:parsed.segments,sourceSha256:sha,checkedAt},changed:sha!==course.sourceSha256,geometryChanged:elevationRouteHash(course)!==elevationRouteHash(parsed)};
}
