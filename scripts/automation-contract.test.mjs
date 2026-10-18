import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('Race and product schedules update independently and serialize writes',async()=>{
 const read=async f=>readFile(new URL('../.github/workflows/'+f,import.meta.url),'utf8');
 const race=await read('refresh-race-data.yml'),catalog=await read('refresh-verified-catalog.yml');
 assert.match(race,/17 \*\/6/);assert.match(catalog,/37 1-23\/6/);
 for(const f of [race,catalog]){assert.match(f,/group: runningbom-data-writer/);assert.match(f,/cancel-in-progress: false/);assert.match(f,/gh workflow run pages.yml/);}
 assert.match(catalog,/continue-on-error: true/);assert.match(catalog,/if: always\(\)/);assert.match(catalog,/npm run catalog:check/);
});
