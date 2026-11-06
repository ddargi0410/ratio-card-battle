import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';import 'firebase/compat/database';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
async function until(f,label){for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,25))}throw new Error('Timed out: '+label)}
test('simulated room lifecycle: create, two joins, play, atomic steal, reconnect, end',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-ratio-card-battle-ui',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../database.rules.json',import.meta.url),'utf8')}});
 const windows=[],errors=[];
 function client(id){const db=env.authenticatedContext(id).database(),vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('warn',(...a)=>console.warn(id,...a));
 const dom=new JSDOM(html,{url:'https://classroom.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 const auth={currentUser:{uid:id},onAuthStateChanged(cb){queueMicrotask(cb);return ()=>{}},async signInAnonymously(){throw new Error('Unexpected real auth')}};
 function database(){return db}database.ServerValue=firebase.database.ServerValue;
 w.firebase={apps:[{}],app(){return {}},auth(){return auth},database};w.scrollTo=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};w.QRCode=class{static CorrectLevel={L:1}};
 }});windows.push(dom.window);return {w:dom.window,db,$:s=>dom.window.document.querySelector(s)}}
 try{const host=client('hostui'),alice=client('aliceui'),bob=client('bobui');host.$('#go-host').click();await host.$('#host-create').onclick();assert.equal(host.$('#hostcfg-err').textContent,'');await until(()=>!host.$('#s-host').hidden,'host');const code=host.$('#h-code').textContent;assert.match(code,/^\d{8}$/);
 for(const [c,name] of [[alice,'별A'],[bob,'별B']]){c.$('#go-join').click();c.$('#j-code').value=code;c.$('#j-name').value=name;await c.$('#j-go').onclick();assert.equal(c.$('#j-err').textContent,'');await until(()=>!c.$('#s-wait').hidden,'lobby')}
 await until(()=>host.$('#h-count').textContent==='2명','roster');await host.$('#h-start').onclick();await until(()=>!alice.$('#s-game').hidden&&!bob.$('#s-game').hidden,'game');
 await host.db.ref('rooms/'+code+'/players/aliceui').update({score:20});await host.db.ref('rooms/'+code+'/players/bobui').update({score:100});await until(()=>alice.w.eval('G.me.score')===20,'score sync');
 const result=await alice.w.eval("G.net.steal('bobui')");assert.equal(result.outcome,'stolen');assert.equal(result.amount,10);const snap=(await host.db.ref('rooms/'+code+'/players').get()).val();assert.equal(snap.aliceui.score,22);assert.equal(snap.bobui.score,90);
 alice.w.goHome();await until(()=>host.w.eval('H.players.aliceui.online')===false,'offline');alice.$('#go-join').click();alice.$('#j-code').value=code;alice.$('#j-name').value='별A';await alice.$('#j-go').onclick();await until(()=>!alice.$('#s-game').hidden,'reconnect');assert.equal(alice.w.eval('G.me.score'),22);
 await host.$('#h-end').onclick();await until(()=>!alice.$('#s-result').hidden&&!bob.$('#s-result').hidden,'results');assert.deepEqual(errors,[]);
 }finally{for(const w of windows)w.close();await env.cleanup()}
});
test('solo mode and eight-digit validation work without backend',async()=>{const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(html,{url:'https://classroom.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{}}}),w=dom.window,$=s=>w.document.querySelector(s);try{$('#go-join').click();$('#j-code').value='12345';$('#j-name').value='학생';await $('#j-go').onclick();assert.match($('#j-err').textContent,/8자리/);w.goHome();$('#go-solo').click();$('#solo-start').click();assert.equal($('#s-game').hidden,false);assert.ok(w.document.querySelectorAll('.card').length>0);assert.deepEqual(errors,[])}finally{w.close()}});
