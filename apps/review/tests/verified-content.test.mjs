import test from 'node:test';import assert from 'node:assert/strict';
import {knownText,knownFacts,shortPurpose,releaseLabel} from '../src/features/verified-content.ts';
import {fitFor} from '../src/features/fit.ts';
import {adaptRaces} from '../src/features/live-races.ts';
test('legacy unknown fields vanish while confirmed portions and zero-drop facts stay visible',()=>{
 for(const value of ['아직 확인 중이에요','공식몰 사이즈 안내를 확인해 주세요','공식 사양 확인 필요','공식 무게 미공개','미확인',undefined,null])assert.equal(knownText(value),'');
 assert.equal(knownText('글로벌 · 한국 일정 미공개'),'글로벌');
 assert.equal(knownText('317g · 어떤 사이즈인지는 안내 없음'),'317g');
 assert.deepEqual(knownFacts([['무게','미확인'],['굽 차이','0mm'],['가격',null]]),[['굽 차이','0mm']]);
 assert.deepEqual(Object.keys(fitFor('not-a-known-fit-model','https://official.example')).filter(key=>key!=='source'),[]);
});
test('short terms distinguish stability from firmness and month releases keep their precision',()=>{
 assert.equal(shortPurpose('탄탄한 지지'),'안정화');assert.equal(shortPurpose('입문·매일 러닝'),'데일리');assert.equal(shortPurpose('빠른 훈련'),'스피드');
 assert.equal(releaseLabel('2027-01'),'2027년 1월');assert.equal(releaseLabel('2027-01-02'),'2027년 1월 2일');assert.equal(releaseLabel(''),'');
});
test('conflicting races stay in the operation snapshot but do not become public cards',()=>{
 const base={id:'known',name:'2027 바다마라톤',raceDate:'2027-12-01',distances:['Half','5km 가족달리기'],region:'부산',venue:'공원',registrationStatus:'open',sourceCheckedAt:'2026-10-18T00:00:00Z'};
 const rows=adaptRaces([base,{...base,id:'review',needsReview:true},{...base,id:'year-conflict',name:'2025 바다마라톤'}],{});
 assert.deepEqual(rows.map(row=>row.id),['known']);assert.deepEqual(rows[0].distances,['하프','가족 5km']);assert.equal(rows[0].round,'');assert.equal(rows[0].eligibility,'');
});
