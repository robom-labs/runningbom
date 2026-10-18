// Only page-declared images or explicitly named hero/poster images from the organizer.
import { load } from 'cheerio';
import { createHash } from 'node:crypto';

export function publicHttps(value, base) {
  if(typeof value!=='string'||!value.trim())return null;
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    if (/^(localhost$|.*\.local$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)) return null;
    return u.href;
  } catch { return null; }
}
export function siteMark(value) {
  return /favicon|apple-touch|\.ico(?:\?|$)|(?:^|\/)(?:logo|symbol|ci)(?:[-_.\/]|$)/i.test(value);
}
export function representativeImages(html, pageUrl, race) {
  const $ = load(html); const values = [];
  const title = $('title').text() + ' ' + $('meta[property="og:title"]').attr('content');
  const edition = String(race.raceDate).slice(0,4);
  const years = title.match(/20\d{2}/g) || [];
  if (years.length && !years.includes(edition)) return []; // An old edition's landing page is not this year's poster.
  const add = (raw, kind, alt = '') => {
    // Old organizer pages often declare HTTP even when the same image supports TLS.
    const upgraded=typeof raw==='string'?publicSourceUrl(raw,pageUrl)?.replace(/^http:/i,'https:'):raw;
    const url = publicHttps(upgraded, pageUrl);
    if (!url || /favicon|apple-touch|\.ico(?:\?|$)/i.test(url) || values.some(x => x.url === url)) return;
    values.push({ url, kind, alt, pageTitle: title.trim() });
  };
  $('img').each((_, el) => {
    const e = $(el), alt = e.attr('alt') || '', identity = [e.attr('class'),e.attr('id'),e.parent().attr('class'),alt,e.attr('src')].join(' ');
    if (/main|visual|hero|poster|포스터|메인|대표|banner|slide/i.test(identity)&&!/icon|btn|button|sponsor|partner|gift|medal|기념품|메달|상품|굿즈/i.test(identity)) add(e.attr('data-src') || e.attr('src'), 'organizer-hero', alt);
  });
  $('[style]').each((_,el)=>{
    const e=$(el),context=[e.attr('class'),e.attr('id'),e.parent().attr('class')].join(' ');
    if(/hero|visual|main|banner|slide|poster|section/i.test(context))for(const m of (e.attr('style')||'').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))add(m[1],'organizer-background');
  });
  // imweb and older Korean event sites declare their hero in an inline stylesheet.
  for(const block of $('style').map((_,e)=>$(e).text()).get())for(const m of block.matchAll(/([^{}]+)\{[^{}]*?(?:background(?:-image)?\s*:[^{};]*?)url\(\s*["']?([^"')]+)["']?\s*\)[^{}]*\}/gi)){
    if(/hero|visual|main|banner|slide|section|background/i.test(m[1]))add(m[2],'organizer-background');
  }
  // Sixshop publishes the actual first hero block in its server-rendered data.
  try{const data=JSON.parse($('script#__NEXT_DATA__').text());for(const q of data.props?.pageProps?.dehydratedState?.queries||[]){
    const hero=q.state?.data?.sections?.[0];for(const block of hero?.blocks||[])for(const item of block.property?.items||[]){const image=item.media?.image?.url;add(typeof image==='string'?image:image?.desktop,'organizer-hero');}
  }}catch{/* No source-declared hero block. */}
  for (const selector of ['meta[property="og:image"]','meta[property="og:image:secure_url"]','meta[name="twitter:image"]']) {
    const raw=$(selector).attr('content');add(raw,siteMark(raw||'')?'event-logo':'page-declared');
  }
  $('header img,.logo img,img[class*="logo"],img[src*="/logo"],img[src*="/top."],img[src*="_top."]').each((_,el)=>add($(el).attr('src'),'event-logo',$(el).attr('alt')||''));
  return values.slice(0,20);
}

export function publicSourceUrl(value,base){
  if(typeof value!=='string')return null;
  try{const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol))return null;
    if(!publicHttps(u.href.replace(/^http:/,'https:')))return null;
    for(const k of [...u.searchParams.keys()])if(/^utm_/i.test(k))u.searchParams.delete(k);u.hash='';return u.href;
  }catch{return null;}
}
export function organizerLinks(html,pageUrl){
 const $=load(html);$('style,script').remove();const output=[];
 $('a[href]').each((_,el)=>{const u=publicSourceUrl($(el).attr('href'),pageUrl);if(!u||!isOrganizerPage(u))return;
  const host=new URL(u).hostname;if(host===new URL(pageUrl).hostname||/google|naver|kakao|youtube|twitter|x\.com|apple|play\.google|runneron|runzoa|kormarathon|marathonmate|runxel|runin\.kr/i.test(host))return;
  if(!output.includes(u))output.push(u);
 });return output.slice(0,4);
}
export function isOrganizerPage(url) {
  try { return !/(^|\.)(marathongo\.co\.kr|marathon\.pe\.kr|facebook\.com|instagram\.com)$/.test(new URL(url).hostname); }
  catch { return false; }
}
export function imageDigest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
