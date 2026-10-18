// Project validated data into the review UI. A local original is used only
// when its SHA matches, so an earlier photo never impersonates another SKU.
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const targetIndex=process.argv.indexOf('--target');
const target=targetIndex<0?join(root,'apps/review'):resolve(process.argv[targetIndex+1]);
await readFile(join(target,'package.json'),'utf8');
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const write=async(p,v)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');};
const catalog=await read('data/verified-products.json');
const assetDir=join(target,'public/assets/products');const assets=await readdir(assetDir).catch(()=>[]);
const products=await Promise.all(catalog.products.map(async p=>{
 let image=p.imageSource;
 for(const file of assets.filter(f=>f.startsWith(p.id+'.'))){const bytes=await readFile(join(assetDir,file));if(p.imageSha256&&createHash('sha256').update(bytes).digest('hex')===p.imageSha256){image='/assets/products/'+file;break;}}
 return {...p,image};
}));
const snapshot={...catalog,products};const text=JSON.stringify(snapshot,null,2)+'\n';
await mkdir(join(target,'public/catalog'),{recursive:true});
await writeFile(join(target,'public/catalog/verified-products.json'),text);
await write(join(target,'public/catalog/verified-products.manifest.json'),{schemaVersion:1,revision:catalog.revision,generatedAt:catalog.generatedAt,sha256:createHash('sha256').update(text).digest('hex'),count:products.length});
await write(join(target,'src/features/products.json'),products);
await write(join(target,'public/product-sources.json'),{schemaVersion:3,checkedAt:catalog.generatedAt,updateMode:'validated Crawlee ingestion; scheduled deployment activation pending',products:products.map(p=>Object.fromEntries(['id','brand','model','sku','color','source','imageSource','image','imageSha256','imageVerification','price','currency','sourceRegion','checkedAt'].map(k=>[k,p[k]??null])))});
await copyFile(join(root,'data/catalog-sources.json'),join(target,'public/catalog-sources.json'));
await copyFile(join(root,'apps/mobile/src/data/races.json'),join(target,'src/features/race-data.json'));
const raceImages=await read('data/race-images.json');
for(const photo of Object.values(raceImages.images)){
 if(!photo.cacheFile||!/^[-a-zA-Z0-9_.]+$/.test(photo.cacheFile))continue;
 try{const file=join(root,'outputs/pushrun-site/assets/races',photo.cacheFile);const bytes=await readFile(file);
  if(createHash('sha256').update(bytes).digest('hex')!==photo.sha256)continue;
  await mkdir(join(target,'public/assets/races'),{recursive:true});await copyFile(file,join(target,'public/assets/races',photo.cacheFile));
  photo.originalImageUrl=photo.url;photo.url='/assets/races/'+photo.cacheFile;
 }catch{/* Keep the original official URL if the matching file is unavailable. */}
}
await write(join(target,'src/features/race-images.json'),raceImages);
await mkdir(join(target,'public/race-data'),{recursive:true});
for(const file of ['manifest.json','races.json'])await copyFile(join(root,'data',file),join(target,'public/race-data',file));
await write(join(target,'public/race-data/race-images.json'),raceImages);
console.log(`Review data: ${products.length} models, ${new Set(products.map(p=>p.brand)).size} brands; ${products.filter(p=>p.image.startsWith('/assets/')).length} matching original files.`);
