import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allocateIncome,monthlyIncome,percentageSummary,percentageUnits} from '../apps/mobile/src/features/onboarding/pyramid-calculations.ts';
test('frontend requires exactly 100%, accepts decimal commas and rejects malformed values',()=>{
 assert.equal(percentageSummary(['50','30','20']).valid,true);
 assert.equal(percentageSummary(['33,33','33.33','33.34']).valid,true);
 for(const input of [['50','30','19'],['50','30','21'],['','50','50'],['-1','51','50'],['100.001','0','0'],['20abc','30','50'],['NaN','0','100']])assert.equal(percentageSummary(input).valid,false);
 assert.equal(percentageUnits('100.00'),10000);assert.equal(percentageUnits('100.01'),null);
});
test('monthly estimate averages defined periods and excludes variable or other currencies',()=>{
 const r=monthlyIncome([
 {estimated_amount:1200,currency:'BOB',frequency:'monthly'},
 {estimated_amount:1200,currency:'BOB',frequency:'yearly'},
 {estimated_amount:120,currency:'BOB',frequency:'weekly'},
 {estimated_amount:100,currency:'BOB',frequency:'biweekly'},
 {estimated_amount:5000,currency:'USD',frequency:'monthly'},
 {estimated_amount:1000,currency:'BOB',frequency:'variable'},
 ],'BOB');assert.equal(r.total,2020);assert.equal(r.excluded,2);
});
test('cent allocations preserve the full monthly estimate including rounded thirds',()=>{
 assert.deepEqual(allocateIncome(10000,[5000,3000,2000]),[5000,3000,2000]);
 const amounts=allocateIncome(100.01,[3333,3333,3334]);
 assert.equal(Math.round(amounts.reduce((a,b)=>a+b,0)*100),10001);
 assert.deepEqual(allocateIncome(0,[5000,3000,2000]),[0,0,0]);
 assert.deepEqual(allocateIncome(100,[5000,3000,1900]),[]);
});

test('three four-area presets and custom sliders allocate monthly household income',()=>{
 for(const values of [[60,20,10,10],[50,15,15,20],[40,10,10,40]]) {
  const result=percentageSummary(values.map(String));
  assert.equal(result.valid,true);
  assert.deepEqual(allocateIncome(10000,result.units),values.map(value=>value*100));
 }
 assert.equal(percentageSummary(['61','20','10','10']).valid,false);
 assert.equal(percentageSummary(['59','20','10','10']).valid,false);
 assert.equal(percentageSummary(['0','0','0','100']).valid,true);
});
