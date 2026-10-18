import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Model} from 'survey-core';
import {requestHints, finderSchema, candidateProducts, needsClinicalCheck, fitEvidenceGap} from '../src/features/finder.ts';
const products=JSON.parse(await readFile(new URL('../src/features/products.json',import.meta.url),'utf8'));
test('negated and unknown phrases do not silently become positive needs',()=>{
 assert.deepEqual(requestHints('발등이 높지 않아요. 발목도 약하지 않아요. 족저근막염은 없어요.'),[]);
 assert.deepEqual(requestHints('아무 운동화나 괜찮습니다'),[]);
 assert.deepEqual(requestHints('발등이 높아요. 칼발이에요.'),['instep','narrow']);
 assert.deepEqual(requestHints('발등이 높지 않고 발볼이 좁아요'),['narrow']);
});
test('existing SurveyJS engine branches and validates the current-pain question',()=>{
 const model=new Model(finderSchema);
 const pain=model.getQuestionByName('discomfort');
 model.setValue('concerns',['instep']); assert.equal(pain.isVisible,false);
 model.setValue('concerns',['ankle']); assert.equal(pain.isVisible,true);
 assert.equal(model.validate(),false);
 model.setValue('discomfort','none'); assert.equal(model.validate(),true);
 model.setValue('concerns',['cushion']); assert.equal(pain.isVisible,false);
 model.dispose();
});
test('no disease or unresolved ankle pain is ranked into product recommendations',()=>{
 for(const concerns of [['plantar'],['ankle']]){
  const answer={concerns,purpose:'cushion',budget:0,discomfort:'now'};
  assert.equal(needsClinicalCheck(answer),true);
  assert.deepEqual(candidateProducts(products,answer),[]);
 }
 assert.equal(needsClinicalCheck({concerns:['plantar'],purpose:'daily',budget:0,discomfort:'none'}),true);
});
test('limited fit data stays explicit while purpose and price candidates obey constraints',()=>{
 const answer={concerns:['instep','narrow'],purpose:'cushion',budget:200000};
 assert.equal(fitEvidenceGap(answer),true);
 const candidates=candidateProducts(products,answer);
 assert.ok(candidates.length>0);
 assert.ok(candidates.every(p=>p.price<=200000&&p.purpose==='푹신한 쿠션'));
 assert.ok(candidateProducts(products,{...answer,budget:100000}).every(p=>p.currency==='KRW'&&p.price!==null&&p.price<=100000&&p.purpose==='푹신한 쿠션'));
});
