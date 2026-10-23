import{CheerioCrawler,Configuration}from'@crawlee/cheerio';import{readFile,writeFile,mkdir,rename}from'node:fs/promises';import{fileURLToPath}from'node:url';import{dirname,join}from'node:path';import{interestFromPage,mapInterest}from'./shoe-interest-core.mjs';import{interestManifest,verifyInterestPair}from'./shoe-interest-publication.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');const records=[],checks=[],failures=[];
if(process.argv.includes('--check')){const text=await readFile(join(root,'data/shoe-interest.json'),'utf8'),manifest=JSON.parse(await readFile(join(root,'data/shoe-interest.manifest.json'),'utf8')),products=JSON.parse(await readFile(join(root,'data/verified-products.json'),'utf8')).products;console.log(JSON.stringify(verifyInterestPair(text,manifest,{products})));process.exit(0);}
const source='https://runrepeat.com/catalog/running-shoes';
const discoveredPages=new Set([source]);
const crawler=new CheerioCrawler({maxConcurrency:1,maxRequestsPerMinute:12,maxRequestsPerCrawl:24,maxRequestRetries:0,respectRobotsTxtFile:true,useSessionPool:false,retryOnBlocked:false,navigationTimeoutSecs:15,
 preNavigationHooks:[async(_context,options)=>{options.headers={'user-agent':'RunningBomCatalog/0.4 (+https://robom.kr)',accept:'text/html'};}],
 async requestHandler({request,$,crawler}){const {rows,next}=interestFromPage($.html(),request.url);records.push(...rows);checks.push({url:request.url,records:rows.length});for(const url of next)discoveredPages.add(url);await crawler.addRequests(next.map(url=>({url})));},
 failedRequestHandler:async({request},error)=>failures.push({url:request.url,error:error.message.slice(0,160)})
},new Configuration({persistStorage:false}));
await crawler.run([{url:source}]);
const products=JSON.parse(await readFile(join(root,'data/verified-products.json'),'utf8')).products;
const rows=mapInterest(products,records);const checkedAt=new Date().toISOString();await mkdir(join(root,'outputs/operations'),{recursive:true});
const checkedPages=new Set(checks.map(c=>c.url));const incompletePages=[...discoveredPages].filter(url=>!checkedPages.has(url));
await writeFile(join(root,'outputs/operations/shoe-interest-refresh.json'),JSON.stringify({checkedAt,checks,failures,incompletePages,observedModels:records.length,matchedProducts:rows.length},null,2)+'\n');
if(rows.length<5)throw new Error('Insufficient measured interest. Last good snapshot retained.');
if(failures.length||incompletePages.length)throw new Error('Incomplete interest collection. Last complete snapshot retained.');
if(process.argv.includes('--write')){
 const payload={schemaVersion:1,checkedAt,source:'RunRepeat',sourceUrl:source,metric:'published-page-views',label:'RunRepeat 공개 조회수 기준',scope:'등록 모델 중 글로벌 관심도 · 국내 판매량 순위가 아닙니다',complete:!failures.length,rows};
 const text=JSON.stringify(payload,null,2)+'\n',manifest=interestManifest(text);verifyInterestPair(text,manifest,{products});
 const path=join(root,'data/shoe-interest.json');await writeFile(path+'.tmp',text);await rename(path+'.tmp',path);await writeFile(join(root,'data/shoe-interest.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 if(!process.argv.includes('--data-only'))for(const base of ['apps/review/public/catalog','apps/mobile/data/catalog','outputs/pushrun-site/data/catalog']){const dir=join(root,base);await mkdir(dir,{recursive:true});await writeFile(join(dir,'shoe-interest.json'),text);await writeFile(join(dir,'shoe-interest.manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
}
console.log(JSON.stringify({checkedAt,observed:records.length,matched:rows.length,failures:failures.length}));
if(failures.length)process.exitCode=1;
