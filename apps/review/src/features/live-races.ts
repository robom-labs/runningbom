import {useEffect,useState} from 'react';
import bundled from './race-data.json';
import bundledImages from './race-images.json';
import type {Race} from './catalog';
import {registrationState} from './race-status';
type RawRace={id:string;name:string;raceDate:string;region:string;venue:string;distances:string[];registrationOpensAt?:string|null;registrationClosesAt?:string|null;registrationTimeConfirmed?:boolean;registrationStatus?:string;registrationDataStatus?:string;sourceCheckedAt?:string|null;sourceName?:string;officialUrl?:string|null;registrationUrl?:string|null;sourceDetailUrl?:string|null;needsReview?:boolean};
type Photo={url:string;source:string;sourceUrl?:string;edition?:string;sha256?:string;checkedAt:string;kind?:string;width?:number;height?:number};
type Photos=Record<string,Photo>;
function usableRows(value:unknown):value is RawRace[]{return Array.isArray(value)&&value.length>0&&value.every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.raceDate)&&Array.isArray(r.distances));}
export function adaptRaces(rows:RawRace[],images:Photos):Race[]{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
 const distance:Record<string,string>={'5K':'5km','10K':'10km',Half:'하프',Full:'풀'};
 return rows.filter(r=>r.raceDate>=today).map(r=>{
  const year=r.name.match(/20\d{2}/)?.[0];const conflict=!!year&&year!==r.raceDate.slice(0,4);
  const photo=images[r.id];const verifiedPhoto=photo?.sha256&&photo.edition===r.raceDate.slice(0,4);
  const date=(v?:string|null)=>v?(r.registrationTimeConfirmed?v:v.slice(0,10)):'';
  const review=conflict||!!r.needsReview||r.registrationDataStatus==='needs-review';
  const status:Race['status']=registrationState({...r,needsReview:review});
  return {id:r.id,name:r.name,region:r.region,venue:r.venue||'',distances:[...new Set(r.distances.map(d=>(distance[d]||d).replace(/(\d+(?:\.\d+)?km)\s*가족달리기/,'가족 $1')))],raceAt:r.raceDate,opensAt:date(r.registrationOpensAt),closesAt:date(r.registrationClosesAt),round:'',eligibility:'',price:null,image:verifiedPhoto?photo.url:'',status,edition:Number(r.raceDate.slice(0,4)),sourceName:r.sourceName||'공개 일정',sourceUrl:r.sourceDetailUrl||r.officialUrl||'',registrationUrl:r.registrationUrl||'',checkedAt:r.sourceCheckedAt||'',timeConfirmed:!!r.registrationTimeConfirmed,imageKind:verifiedPhoto?photo.kind:undefined,imageWidth:verifiedPhoto?photo.width:undefined,imageHeight:verifiedPhoto?photo.height:undefined,imageSource:verifiedPhoto?photo.sourceUrl||photo.source:'',needsReview:review};
 }).filter(r=>!r.needsReview&&r.status!=='확인 필요')
 // Both directory entries name the same organizer, date, course and official
 // /2026/ event page. Retain the Korean canonical ID; never merge by name alone.
 .filter(r=>r.id!=='schedule-dd6c6bcc11f2'||!rows.some(p=>p.id==='schedule-0e4e73276928'&&p.raceDate===r.raceAt))
 .sort((a,b)=>Number(['접수중','마감임박'].includes(b.status))-Number(['접수중','마감임박'].includes(a.status))||a.raceAt.localeCompare(b.raceAt));
}
export function useLiveRaces(){
 const [raw,setRaw]=useState<RawRace[]>(bundled.races as RawRace[]),[photos,setPhotos]=useState<Photos>(bundledImages.images),[health,setHealth]=useState('마지막 확인 일정');
 useEffect(()=>{
  const controller=new AbortController();const base=String(import.meta.env.VITE_RACE_DATA_URL||'/race-data/').replace(/\/?$/,'/');let busy=false;
  const refresh=async()=>{if(busy)return;busy=true;try{
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
   const [manifestRes,raceRes,photoRes]=await Promise.all([fetch(base+'manifest.json',{signal,cache:'no-cache'}),fetch(base+'races.json',{signal,cache:'no-cache'}),fetch(base+'race-images.json',{signal,cache:'no-cache'})]);
   if(!manifestRes.ok||!raceRes.ok)throw new Error('race data unavailable');
   const manifest=await manifestRes.json(),text=await raceRes.text();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==manifest.checksums?.['races.json'])throw new Error('race checksum');const next=JSON.parse(text);if(!usableRows(next.records))throw new Error('race schema');
   const max=(rows:RawRace[])=>Math.max(...rows.map(r=>Date.parse(r.sourceCheckedAt||'')||0));
   setRaw(current=>max(next.records)>=max(current)?next.records:current);
   if(photoRes.ok){const p=await photoRes.json();if(p.schemaVersion===1&&p.images&&typeof p.images==='object')setPhotos(p.images);}
   setHealth('일정 자료 자동 확인');
  }catch{if(!controller.signal.aborted)setHealth('마지막 확인 일정으로 보기');}finally{busy=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),15*60*1000);return()=>{controller.abort();clearInterval(timer);};
 },[]);
 return {races:adaptRaces(raw,photos),health};
}
