// Minimized reproducer, not a new source receipt or an approval of these assets.
export const garminURL='https://runable.me/product/18977?comp=18962';
export const garminRace={id:'garmin-fixture',name:'2026 가민런 코리아',raceDate:'2026-11-15',distances:['10K']};
export function garminPage({kind='description',date='2026-11-15',canonical=garminURL}={}){
 return `<!doctype html><html><head><title>2026 가민런 코리아</title><link rel="canonical" href="${canonical.replaceAll('&','&amp;')}"><meta ${kind==='description'?'name="description"':'property="og:description"'} content="2026 가민런 코리아 · 대회일 ${date}"></head><body><h1>2026 가민런 코리아</h1><a href="/course">코스 안내</a></body></html>`;
}
export const garminCourse='<title>2026 가민런 코리아 코스 안내</title><h1>가민런 코리아</h1><img alt="10km 공식 코스도" src="/course-10km.png">';
