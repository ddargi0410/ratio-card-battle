const assert=require('node:assert/strict');
const {test}=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const script=html.match(/<script>\s*('use strict';[\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Parse the complete shipped script, not only extracted functions.
const code=script.slice(script.indexOf('function applyStealRequest('),script.indexOf('async function processSteal('));
const ctx=vm.createContext({ITEMS:[{id:'steal',cost:8}],IMMUNE_MS:10000,STEAL_PCT:.1});
vm.runInContext(code,ctx);
const time=100000;
const room=()=>({meta:{status:'playing',shop:true,steal:true,expiresAt:200000},players:{a:{name:'A',score:20,guard:0},b:{name:'B',score:100,guard:0}},requests:{a:{id:'request1',target:'b',createdAt:time}}});
function run(r){return ctx.applyStealRequest(r,'a','request1',time)}
test('steal atomically pays cost, transfers 10%, writes result and notifications',()=>{const r=run(room());assert.equal(r.players.a.score,22);assert.equal(r.players.b.score,90);assert.equal(r.players.b.hitAt,time);assert.equal(r.results.a.request1.outcome,'stolen');assert.equal(r.inbox.b.request1.amount,10);assert.equal(r.requests.a,undefined)});
test('processing duplicate ID cannot charge twice',()=>{const r=run(room());assert.equal(run(r),undefined);assert.equal(r.players.a.score,22)});
test('cancelled or replaced request cannot execute',()=>{const r=room();r.requests.a.id='other';assert.equal(run(r),undefined);assert.equal(r.players.a.score,20)});
test('shield consumes shield and charge, but no transfer',()=>{const r=room();r.players.b.guard=1;run(r);assert.equal(r.players.a.score,12);assert.equal(r.players.b.score,100);assert.equal(r.players.b.guard,0);assert.equal(r.results.a.request1.outcome,'blocked')});
for(const [label,change,outcome] of [
 ['insufficient funds',r=>r.players.a.score=7,'funds'],
 ['target immunity',r=>r.players.b.hitAt=time-1,'immune'],
 ['target empty',r=>r.players.b.score=0,'empty'],
 ['target negative',r=>r.players.b.score=-20,'empty'],
 ['self target',r=>r.requests.a.target='a','gone'],
 ['missing target',r=>delete r.players.b,'gone'],
 ['room ended',r=>r.meta.status='ended','expired'],
 ['room expired',r=>r.meta.expiresAt=time,'expired'],
 ['stale request',r=>r.requests.a.createdAt=time-15001,'expired'],
 ['disabled steal',r=>r.meta.steal=false,'expired'],
 ['disabled shop',r=>r.meta.shop=false,'expired']])test(label+' is rejected without a charge',()=>{const r=room();change(r);const before=r.players.a.score;run(r);assert.equal(r.players.a.score,before);assert.equal(r.results.a.request1.outcome,outcome)});
test('other pending request is preserved',()=>{const r=room();r.requests.b={id:'request2',target:'a',createdAt:time};run(r);assert.equal(r.requests.b.id,'request2')});
test('no open rules or global _check writes remain in the app',()=>{assert.ok(!html.includes('".read": true'));assert.ok(!html.includes("rooms/_check"));assert.ok(html.includes('signInAnonymously'));assert.ok(html.includes('crypto.getRandomValues'))});
