import test from 'node:test';import assert from 'node:assert/strict';
import{readFile,writeFile,mkdir,mkdtemp,rm}from'node:fs/promises';import{join}from'node:path';import{tmpdir}from'node:os';import{spawnSync}from'node:child_process';
const adapter=await readFile(new URL('../apps/mobile/scripts/fix-metro-image-size.mjs',import.meta.url),'utf8');
const old='const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;';
async function fixture(version,source,run){
 const root=await mkdtemp(join(tmpdir(),'runningbom-metro-adapter-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'node_modules/metro/src'),{recursive:true});
  await writeFile(join(root,'scripts/fix.mjs'),adapter);await writeFile(join(root,'node_modules/metro/package.json'),JSON.stringify({version}));
  const file=join(root,'node_modules/metro/src/Assets.js');await writeFile(file,source);
  await run({file,execute:()=>spawnSync(process.execPath,[join(root,'scripts/fix.mjs')],{encoding:'utf8'})});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('pinned Metro uses original image bytes with fixed image-size parser and patch is idempotent',()=>fixture('0.84.4',old,async({file,execute})=>{
 assert.equal(execute().status,0);const next=await readFile(file,'utf8');
 assert.match(next,/typeof isImageInput === "string" \? _fs\.default\.readFileSync\(isImageInput\) : isImageInput/);
 assert.equal(execute().status,0);assert.equal(await readFile(file,'utf8'),next);
}));
test('unknown Metro versions fail without modifying the dependency',()=>fixture('0.85.0',old,async({file,execute})=>{
 assert.notEqual(execute().status,0);assert.equal(await readFile(file,'utf8'),old);
}));
test('already adapted code cannot bypass the supported Metro version guard',async()=>{
 let patched;
 await fixture('0.84.4',old,async({file,execute})=>{assert.equal(execute().status,0);patched=await readFile(file,'utf8');});
 await fixture('0.85.0',patched,async({file,execute})=>{assert.notEqual(execute().status,0);assert.equal(await readFile(file,'utf8'),patched);});
});
test('changed Metro API shape fails without guessing a replacement',()=>fixture('0.84.4','const dimensions = futureImageParser(input);',async({file,execute})=>{
 assert.notEqual(execute().status,0);assert.equal(await readFile(file,'utf8'),'const dimensions = futureImageParser(input);');
}));
