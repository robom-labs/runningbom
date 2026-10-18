export const feedTopics=['전체','러닝일상','대회후기','러닝화','질문','응원'] as const;
export const feedRegions=['전체','서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'] as const;
export type FeedCursor={createdAt:string;id:string};
export function postTags(body:string){return [...new Set(Array.from(body.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu),m=>m[1]))];}
export function taggedPost(body:string,topic:string,region:string){
 const normalized=body.trim();const tags=postTags(normalized);
 const extra=[topic,region].filter(tag=>tag!=='전체'&&tag&&!tags.includes(tag));
 return normalized+(extra.length?'\n\n'+extra.map(tag=>'#'+tag).join(' '):'');
}
export function validFeedCursor(cursor:FeedCursor){return /^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(cursor.createdAt)&&Number.isFinite(Date.parse(cursor.createdAt))&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id);}
export function mergeFeed<T extends {id:string}>(current:T[],next:T[]){const seen=new Set(current.map(p=>p.id));return [...current,...next.filter(p=>!seen.has(p.id)&&!!seen.add(p.id))];}
export function relativePostTime(value:string,now=Date.now()){
 const minutes=Math.max(0,Math.floor((now-Date.parse(value))/60000));
 if(minutes<1)return '방금';if(minutes<60)return minutes+'분 전';
 const hours=Math.floor(minutes/60);if(hours<24)return hours+'시간 전';
 const days=Math.floor(hours/24);if(days<7)return days+'일 전';
 return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',timeZone:'Asia/Seoul'}).format(new Date(value));
}
