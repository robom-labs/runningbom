// Source records keep their provenance; display fields never carry uncertainty placeholders.
const unavailable = /미확인|미공개|미정|확인\s*중|확인\s*필요|안내\s*없|안내하지\s*않|안내되지|공식.*(?:사이즈|사양).*확인|색상명.*공개|컬러명.*공개/;
export function publishedText(value) {
 if(typeof value!=='string')return '';
 return value.split(/\s+·\s+/).map(part=>part.trim()).filter(part=>part&&!unavailable.test(part)).join(' · ');
}
export function publicationFields(product) {
 const next={...product};
 for(const key of ['plate','weight','drop','gender','releaseRegion'])next[key]=publishedText(product[key]);
 if(next.category==='unknown'){next.purpose='';next.tier='';next.description='';}
 return next;
}
