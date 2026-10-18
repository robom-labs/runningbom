// Official press announcements cover shoes that do not yet have a shop listing.
import {CheerioCrawler,Configuration} from '@crawlee/cheerio';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';import{createHash}from'node:crypto';
import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';
import{load}from'cheerio';
import{productSchema,mergeVerified,releaseIsUpcoming,pressReleaseDate,announcementForCatalog,classify,categoryLabels}from'./catalog-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');const path=join(root,'data/verified-products.json');
const previous=JSON.parse(await readFile(path,'utf8'));const config=JSON.parse(await readFile(join(root,'data/shoe-release-sources.json'),'utf8'));
const checkedAt=new Date().toISOString(),incoming=[],failures=[];
// Discover individual shoe-family announcements from observed official newsroom links.
// Unsupported/ambiguous headlines are retained as a discovery report, not guessed products.
const discovered=[];
try{
 const index=await fetch('https://about.nike.com/en/newsroom',{signal:AbortSignal.timeout(12000)});if(!index.ok)throw new Error('newsroom HTTP '+index.status);
 const $=load(await index.text());
 $('a[href*="/newsroom/releases/"]').each((_,e)=>{
  const title=$(e).text().replace(/\s+/g,' ').trim();
  const match=title.match(/\bNike\s+((?:Apex|Alphafly|Swooshfly|Vaporfly|Pegasus|Vomero|Structure|Streakfly)(?:\s+(?:Plus|Premium|Trail))?(?:\s+\d+)?)(?=\s|:|$)/i);if(!match)return;
  const modelEn=match[1];const url=new URL($(e).attr('href'),'https://about.nike.com').href;if(new URL(url).hostname!=='about.nike.com')return;
  discovered.push({modelEn,url});if(config.articles.some(a=>a.modelEn.toLowerCase()===modelEn.toLowerCase()))return;
  const labels={Apex:'에이펙스',Alphafly:'알파플라이',Swooshfly:'스우시플라이',Vaporfly:'베이퍼플라이',Pegasus:'페가수스',Vomero:'보메로',Structure:'스트럭처',Streakfly:'스트릭플라이'};
  const model=modelEn.replace(/^[A-Za-z]+/,word=>labels[Object.keys(labels).find(k=>k.toLowerCase()===word.toLowerCase())]||word);
  config.articles.push({url,model,modelEn,id:'nike-'+modelEn.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-announced',release:'',releaseRegion:'공식 발표 기준 · 국내 일정 원문 확인',plate:'공식 수치 미공개',drop:'공식 수치 미공개',description:'공식 뉴스룸에서 발표한 '+model+' 모델입니다. 출시 지역과 판매 가격은 원문에서 확인해 주세요.',autoDiscovered:true});
 });
}catch(e){failures.push({url:'https://about.nike.com/en/newsroom',reason:e.message});}
const crawler=new CheerioCrawler({maxConcurrency:2,maxRequestRetries:0,maxSessionRotations:0,maxRequestsPerCrawl:12,navigationTimeoutSecs:15,respectRobotsTxtFile:true,useSessionPool:false,
 async requestHandler({request,$}){
  const article=config.articles.find(x=>x.url===request.url);if(!article)return;
  const text=$('main').text()||$('body').text();if(!text.toLowerCase().includes(article.modelEn.toLowerCase()))throw new Error('model identity changed');
  const publication=$('time').first().attr('datetime')||$('meta[property="article:published_time"]').attr('content')||'';
  const release=pressReleaseDate(text,publication.slice(0,4)||article.release.slice(0,4));if(!release)throw new Error('Explicit availability date not found; prior announcement retained');
  const model=article.modelEn.toLowerCase();const image=$('img').toArray().map(e=>({url:$(e).attr('src')||$(e).attr('data-src'),alt:$(e).attr('alt')||''})).find(x=>x.url?.startsWith('https://nmp.about.nike.com/')&&x.alt.toLowerCase().includes(model))?.url||$('meta[property="og:image"]').attr('content');
  if(!image?.startsWith('https://'))throw new Error('No original announcement photograph');
  const response=await fetch(image,{signal:AbortSignal.timeout(12000)});if(!response.ok||!/^image\//.test(response.headers.get('content-type')||''))throw new Error('Original media unavailable');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<2000||bytes.length>12000000)throw new Error('media size');const hash=createHash('sha256').update(bytes).digest('hex');
  const ext=/png/.test(response.headers.get('content-type')||'')?'png':/webp/.test(response.headers.get('content-type')||'')?'webp':'jpg';
  await mkdir(join(root,'apps/review/public/assets/products'),{recursive:true});await writeFile(join(root,'apps/review/public/assets/products',article.id+'.'+ext),bytes);
  const p={id:article.id,brand:'NIKE',name:article.model,model:article.model,modelEn:article.modelEn,source:article.url,imageSource:image,image,checkedAt,price:null,regularPrice:null,currency:'XXX',sourceRegion:'공식 글로벌 발표',sku:null,color:'공식 발표 이미지 · 컬러명 미공개',gender:'미공개',category:'carbon',uses:['race'],purpose:'대회용 카본',tier:'대회용 카본',description:article.description,plate:article.plate,weight:'공식 무게 미공개',drop:article.drop,release:article.release,releaseRegion:article.releaseRegion,releaseSource:article.url,upcoming:releaseIsUpcoming(article.release),merchant:'NIKE 공식 뉴스룸',priceType:'판매 가격 발표 전',imageSha256:hash,imageVerification:'original-bytes',evidenceKind:'official-announcement'};
  p.release=release;p.upcoming=releaseIsUpcoming(release);
  if(article.autoDiscovered){const [category,uses]=classify(article.modelEn);if(category==='unknown')throw new Error('Model category requires source verification');p.category=category;p.uses=uses;p.purpose=categoryLabels[category];p.tier=p.purpose;}
  const candidate=announcementForCatalog(previous.products,p);productSchema.parse(candidate);incoming.push(candidate);console.log('Verified official release: '+article.modelEn);
 },failedRequestHandler:async({request},e)=>failures.push({url:request.url,reason:e.message.slice(0,150)})
},new Configuration({persistStorage:false}));
await crawler.run(config.articles.map(x=>({url:x.url})));
if(!incoming.length)throw new Error('No announcement verified. Last good catalog retained.');
const merged=mergeVerified(previous.products,incoming);const text=JSON.stringify(merged.products);const next={...previous,revision:'catalog-'+createHash('sha256').update(text).digest('hex').slice(0,16),generatedAt:checkedAt,products:merged.products};
await writeFile(path+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(path+'.tmp',path);await import('./sync-verified-products.mjs');
await mkdir(join(root,'outputs/operations'),{recursive:true});await writeFile(join(root,'outputs/operations/release-announcements.json'),JSON.stringify({checkedAt,verified:incoming.length,added:merged.added,discovered,failures},null,2)+'\n');
