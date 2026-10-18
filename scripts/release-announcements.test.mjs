import test from 'node:test';import assert from 'node:assert/strict';
import{pressReleaseDate,announcementForCatalog}from'./catalog-core.mjs';
test('availability date wins over an earlier press-publication date',()=>{
 assert.equal(pressReleaseDate('September 30, 2026. What is it? Shoe. When is it available? Available in January 2027 at Nike.com.',2026),'2027-01');
});
test('a press announcement cannot erase a retail SKU, market price, photograph or shop timestamp',()=>{
 const retail={id:'shop',brand:'NIKE',modelEn:'Apex',sku:'SKU-100',price:299000,currency:'KRW',source:'https://www.nike.com/exact',imageSource:'https://static.nike.com/exact.jpg',checkedAt:'2026-10-01T00:00:00Z',release:'2026-10',releaseSource:'https://www.nike.com/kr/release',releaseRegion:'한국'};
 const announcement={id:'press',brand:'NIKE',modelEn:'Apex',sku:null,price:null,source:'https://about.nike.com/release',release:'2027-01',checkedAt:'2026-10-18T00:00:00Z'};
 const next=announcementForCatalog([retail],announcement);for(const k of ['sku','price','currency','source','imageSource','checkedAt','release','releaseRegion'])assert.equal(next[k],retail[k]);assert.equal(next.announcementCheckedAt,announcement.checkedAt);
});
test('first limited launch and broader retail launch are not conflated',()=>{
 assert.equal(pressReleaseDate('When is it available? Early limited release September 17, followed by broader availability October 29.',2026),'2026-09-17');
});
test('a foreign regional launch retains month precision and does not invent a Korean day',()=>{
 assert.equal(pressReleaseDate('When is it available? Launch in China in February 2027 before global availability that spring.',2026),'2027-02');
});
test('publication dates and vague coming soon text never manufacture release dates',()=>{
 assert.equal(pressReleaseDate('September 30, 2026. A new shoe is coming soon.',2026),undefined);
 assert.equal(pressReleaseDate('When is it available? February 30, 2027.',2026),undefined);
});
