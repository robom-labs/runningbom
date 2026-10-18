import test from 'node:test';import assert from 'node:assert/strict';
import { representativeImages,publicHttps,isOrganizerPage,organizerLinks,publicSourceUrl } from './race-image-core.mjs';
test('Organizer-declared poster is decoded and bound to the event edition',()=>{
 const h='<title>2026 가을 마라톤</title><meta property="og:image" content="/poster.jpg?a=1&amp;b=2"><main><img src="/logo.png"><img class="hero" src="/hero.jpg"></main>';
 const found=representativeImages(h,'https://event.example/',{raceDate:'2026-11-01'});
 assert.deepEqual(found.map(x=>x.url),['https://event.example/hero.jpg','https://event.example/poster.jpg?a=1&b=2','https://event.example/logo.png']);
 assert.equal(found.at(-1).kind,'event-logo');
 assert.equal(representativeImages(h,'https://event.example/',{raceDate:'2027-11-01'}).length,0);
});
test('Sixshop first hero is preferred to merchandise used as the generic OG thumbnail',()=>{
 const data={props:{pageProps:{dehydratedState:{queries:[{state:{data:{sections:[{blocks:[{property:{items:[{media:{image:{url:{desktop:'https://cdn.example/2026-race-hero.png'}}}}]}}]}]}}}]}}}};
 const html='<title>2026 대회</title><meta property="og:image" content="https://cdn.example/towel.png"><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(data)+'</script>';
 assert.equal(representativeImages(html,'https://official.example/',{raceDate:'2026-11-01'})[0].url,'https://cdn.example/2026-race-hero.png');
});
test('HTTP labels upgrade image URLs and organizer links retain provenance without tracking',()=>{
 assert.equal(representativeImages('<title>2026 대회</title><meta property="og:image" content="http://photo.example/2026.jpg">','https://race.example/',{raceDate:'2026-11-01'})[0].url,'https://photo.example/2026.jpg');
 assert.deepEqual(organizerLinks('<a href="http://official.example/event?utm_source=marathongo">공식홈페이지</a><a href="https://instagram.com/x">SNS</a><a href="http://127.0.0.1/">bad</a>','https://marathongo.co.kr/race/a'),['http://official.example/event']);
 assert.equal(publicSourceUrl('http://192.168.0.1/poster'),null);
});
test('Organizer main images and inline CSS heroes are collected without guessing paths',()=>{
 const h='<title>2026 대회</title><img src="/img/main.jpg"><div class="hero" style="background-image:url(\'/event.jpg\')"></div><style>.main_visual{background:url(/background.jpg)}</style>';
 assert.deepEqual(representativeImages(h,'https://official.example/',{raceDate:'2026-11-01'}).map(x=>x.url),['https://official.example/img/main.jpg','https://official.example/event.jpg','https://official.example/background.jpg']);
});
test('Aggregator thumbnails, local endpoints and site marks cannot become official posters',()=>{
 assert.equal(isOrganizerPage('https://marathongo.co.kr/race/a'),false);
 assert.equal(publicHttps('https://127.0.0.1/a.png'),null);
 assert.equal(publicHttps('http://event.example/a.png'),null);
 assert.equal(representativeImages('<meta property="og:image" content="/favicon.ico">','https://event.example/',{raceDate:'2026-01-01'}).length,0);
});
