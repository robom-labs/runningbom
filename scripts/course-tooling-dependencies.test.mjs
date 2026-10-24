import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {relative,sep} from 'node:path';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));

test('course image decoder is an exact direct root dependency with immutable lock receipt, not an app/transitive dependency',async()=>{
 const [pkg,lock]=await Promise.all([read('package.json'),read('package-lock.json')]);
 assert.equal(pkg.dependencies['image-size'],'2.0.4');
 assert.equal(lock.packages[''].dependencies['image-size'],'2.0.4');
 const entry=lock.packages['node_modules/image-size'];
 assert.equal(entry.version,'2.0.4');assert.equal(entry.resolved,'https://registry.npmjs.org/image-size/-/image-size-2.0.4.tgz');
 assert.equal(entry.integrity,'sha512-QRUkFFsRV/6fuESxb9Vkq+a0LkSrgKXuc2NEqfikiXxxN/G3tjWt5EVUlMaImRBZRZK/jRBEbYvpPYZL8t08Zw==');
 assert.deepEqual(entry.dependencies||{},{});assert.equal(entry.engines.node,'>=18');
});

test('all bare runtime imports reachable from course tools are declared directly at root',async()=>{
 const pkg=await read('package.json'),visited=new Set(),bare=new Set();
 async function walk(url){
  if(visited.has(url.href))return;visited.add(url.href);
  const source=await readFile(url,'utf8');
  for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)){
   const spec=m[1];if(spec.startsWith('node:'))continue;
   if(spec.startsWith('.')){if(/\.(?:mjs|js)$/.test(spec))await walk(new URL(spec,url));continue;}
   const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];bare.add(name);
   assert.match(pkg.dependencies?.[name]||'',/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/,`undeclared/unpinned direct course dependency ${name} in ${url.pathname}`);
  }
 }
 for(const path of ['scripts/course-discover-sources.mjs','scripts/refresh-approved-course-sources.mjs','scripts/update-course-elevation.mjs','scripts/maintain-course-elevation.mjs','scripts/publish-course-catalog.mjs','scripts/course-data-publication.mjs'])await walk(new URL(path,root));
 assert(bare.has('image-size'));assert(bare.has('cheerio'));
});

test('clean-install verification resolves physical root dependencies, with no app modules or symlink rescue',async t=>{
 if(process.env.COURSE_REQUIRE_CLEAN_INSTALL!=='1')return t.skip('enforced by the external clean npm-ci sandbox');
 const rootPath=await realpath(root),modules=new URL('node_modules/',root),moduleStat=await lstat(modules);
 assert(!moduleStat.isSymbolicLink(),'root node_modules cannot be linked');
 for(const name of ['image-size','cheerio']){
  const url=import.meta.resolve(name),resolved=await realpath(fileURLToPath(url)),rel=relative(rootPath,resolved);
  assert(rel.startsWith('node_modules'+sep),`${name} escaped isolated root: ${resolved}`);
  assert(!rel.includes('apps'+sep+'mobile'),'app dependency rescue refused');
  assert(!(await lstat(new URL('node_modules/'+name,root))).isSymbolicLink());
 }
 const installed=JSON.parse(await readFile(new URL('node_modules/image-size/package.json',root),'utf8'));
 assert.equal(installed.version,'2.0.4');
 const {imageSize}=await import('image-size');assert.equal(typeof imageSize,'function');
 const appModules=new URL('apps/mobile/node_modules',root);await assert.rejects(lstat(appModules),{code:'ENOENT'});
});

test('scheduled course job retains existing tests and runs dependency plus meta-refresh regressions',async()=>{
 const workflow=await readFile(new URL('.github/workflows/refresh-course-catalog.yml',root),'utf8');
 for(const file of ['course-discovery.test.mjs','course-discovery-rejections.test.mjs','course-metadata-inputs.test.mjs','course-data-publication.test.mjs','course-source-refresh-core.test.mjs','course-meta-refresh.test.mjs','course-tooling-dependencies.test.mjs','course-discovery-frontier.test.mjs'])assert(workflow.includes('scripts/'+file),file);
 assert.match(workflow,/npm ci --ignore-scripts/);assert.doesNotMatch(workflow,/npm (?:install|ci)[^\n]*--prefix apps\/mobile/);
});
