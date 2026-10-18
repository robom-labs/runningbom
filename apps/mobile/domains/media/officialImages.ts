// Organizer-selected image URLs, source edition and original-byte hashes.
// OG metadata is provenance, not a commercial image licence.
// Missing media is omitted; no substitute event artwork.
import data from '../../src/data/official-images.json';
import {useSyncExternalStore} from 'react';

export type OfficialImage = {
  /** https 절대 주소입니다. */
  url: string;
  /** 어느 페이지의 어떤 태그에서 왔는지입니다. */
  source: string;
  /** 언제 확인했는지입니다. YYYY-MM-DD */
  checkedAt: string;
  sourceUrl?:string;
  sha256?:string;
  edition?:string;
  kind?:string;
  width?:number;
  height?:number;
};

export type OfficialImageFile = {
  revision: number;
  checkedAt: string;
  images: Record<string, OfficialImage>;
};

/** http는 안 됩니다(안드로이드가 기본으로 막고, 중간에서 바꿔치기될 수 있습니다). */
export function isUsableImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  if (!url.startsWith('https://')) return false;
  // 데이터 URI를 넣으면 번들이 통째로 무거워집니다.
  if (url.length > 600) return false;
  return true;
}

export function parseOfficialImages(raw: unknown): Record<string, OfficialImage> {
  if (!raw || typeof raw !== 'object') return {};
  const file = raw as Partial<OfficialImageFile>;
  if (!file.images || typeof file.images !== 'object') return {};

  const parsed: Record<string, OfficialImage> = {};
  for (const [id, value] of Object.entries(file.images)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<OfficialImage>;
    // 셋 중 하나라도 없으면 안 씁니다. 출처를 못 밝히는 그림은 화면에 내지 않습니다.
    if (!isUsableImageUrl(item.url)) continue;
    if (typeof item.source !== 'string' || item.source.length === 0) continue;
    if (typeof item.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt)) continue;
    parsed[id] = { url: item.url, source: item.source, checkedAt: item.checkedAt,sourceUrl:item.sourceUrl,sha256:item.sha256,edition:item.edition,kind:item.kind,
      width:typeof item.width==='number'&&item.width>0?item.width:undefined,
      height:typeof item.height==='number'&&item.height>0?item.height:undefined };
  }
  return parsed;
}

export function mergeVerifiedOfficialImages(current:Record<string,OfficialImage>,raw:unknown){
 const next=parseOfficialImages(raw);let merged=current;
 for(const [id,p] of Object.entries(next)){
  if(!p.sha256||!(/^[a-f0-9]{64}$/.test(p.sha256))||!isUsableSourcePage(p.sourceUrl)||!/^20\d{2}$/.test(p.edition||''))continue;
  if(current[id]&&p.checkedAt<current[id].checkedAt)continue;
  if(JSON.stringify(current[id])===JSON.stringify(p))continue;
  if(merged===current)merged={...current};merged[id]=p;
 }
 return merged;
}
export function isUsableSourcePage(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/^(localhost$|.*\.local$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname);}catch{return false;}
}
let images = parseOfficialImages(data);
const listeners=new Set<()=>void>();let timer:ReturnType<typeof setInterval>|undefined;let pending=false;
async function refreshOfficialImages(){if(pending)return;pending=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{
 const base=(process.env.EXPO_PUBLIC_CATALOG_URL||'https://robom-labs.github.io/runningbom/data/').replace(/\/?$/,'/');if(!base.startsWith('https://'))return;
 const res=await fetch(base+'race-images.json',{signal:controller.signal,cache:'no-cache'});if(!res.ok)return;const raw=await res.json();if(raw.schemaVersion!==1||!raw.images)return;
 const next=mergeVerifiedOfficialImages(images,raw);if(next===images)return;
 images=next;for(const fn of listeners)fn();
}catch{/* retain verified bundle/cache */}finally{clearTimeout(timeout);pending=false;}}
function subscribeOfficialImages(fn:()=>void){listeners.add(fn);if(!timer){void refreshOfficialImages();timer=setInterval(()=>void refreshOfficialImages(),15*60*1000);}return()=>{listeners.delete(fn);if(!listeners.size){clearInterval(timer);timer=undefined;}};}
export function useOfficialImage(id:string|undefined){return useSyncExternalStore(subscribeOfficialImages,()=>id?images[id]:undefined,()=>id?images[id]:undefined);}

/** Verified image metadata. Missing media stays omitted in customer screens. */
export function officialImage(id: string): OfficialImage | undefined {
  return images[id];
}

export function officialImageCount(): number {
  return Object.keys(images).length;
}

/** 그림 밑에 붙는 출처 한 줄입니다. 남의 그림을 우리 것처럼 보이게 하지 않습니다. */
export function imageCreditLabel(image: OfficialImage): string {
  return `${image.source} 공개 이미지`;
}
