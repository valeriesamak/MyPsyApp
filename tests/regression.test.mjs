import fs from 'fs';
import { JSDOM } from 'jsdom';
import React from 'react';
import ReactDOMClient from 'react-dom/client';
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://example.com/',pretendToBeVisual:true});
const {window}=dom; global.window=window; global.document=window.document;
Object.defineProperty(global,'navigator',{value:window.navigator,configurable:true});
for(const k of ['HTMLElement','Element','Node','Blob','File','URL','HTMLInputElement','HTMLTextAreaElement','Audio','FileReader']) global[k]=window[k];
global.getComputedStyle=window.getComputedStyle; global.localStorage=window.localStorage;
global.requestAnimationFrame=cb=>setTimeout(cb,0); global.IS_REACT_ACT_ENVIRONMENT=true;
window.alert=()=>{}; let answers=[]; window.confirm=()=>answers.length?answers.shift():true;
let micStopped=false;
window.navigator.mediaDevices={ getUserMedia: async()=>({ getTracks:()=>[{stop:()=>{micStopped=true;}}] }) };
class FakeMR{ constructor(){this.state='inactive';} start(){this.state='recording'; setTimeout(()=>this.ondataavailable({data:new window.Blob(['x'])}),0);} stop(){this.state='inactive'; this.onstop();} }
window.MediaRecorder=FakeMR; global.MediaRecorder=FakeMR;
const d=new Date(); const iso=x=>x.toISOString().slice(0,10); const day=n=>iso(new Date(d.getTime()-n*864e5));
window.localStorage.setItem('clinic_data_v1',JSON.stringify({schemaVersion:2, settings:{showPaymentReminders:true},
 patients:[
  {id:'p1',name:'דנה כהן',phone:'0501111111',sessionRate:300,payerType:'private'},
  {id:'p2',name:'יוסי לוי',phone:'0502222222',sessionRate:250,payerType:'private'}],
 appointments:[
  {id:'n1',patientId:'p1',date:day(2),startTime:'11:00',duration:50,status:'completed',paid:true},
  {id:'u1',patientId:'p2',date:day(45),startTime:'12:00',duration:50,status:'completed',paid:false,notes:'x'},
  {id:'u2',patientId:'p2',date:day(38),startTime:'12:00',duration:50,status:'completed',paid:false,notes:'x'},
  {id:'x1',patientId:'p2',date:day(30),startTime:'09:00',duration:50,status:'scheduled',paid:false},
  {id:'x2',patientId:'p2',date:day(23),startTime:'09:00',duration:50,status:'noshow',paid:false}],
 payments:[]}));
window.React=React; window.ReactDOM=ReactDOMClient; global.React=React; global.ReactDOM=ReactDOMClient;
const html=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const {act}=await import('react-dom/test-utils');
await act(async()=>{ (0,eval)(scripts[scripts.length-1]); });
const store=()=>JSON.parse(window.localStorage.getItem('clinic_data_v1'));
const txt=()=>document.getElementById('root').textContent;
const findAll=(sel,re)=>[...document.querySelectorAll(sel)].filter(e=>re.test(e.textContent));
const click=async(el,w)=>{ if(!el) throw new Error('nf '+w); await act(async()=>el.dispatchEvent(new window.MouseEvent('click',{bubbles:true}))); };
const setVal=async(el,v)=>{ const k=Object.keys(el).find(x=>x.startsWith('__reactProps$')); await act(async()=>el[k].onChange({target:{value:v}})); };
let bad=0; const check=(n,ok)=>{ if(!ok)bad++; console.log((ok?'PASS ':'FAIL ')+n); };

// --- billing: only confirmed sessions count (v3.0 fix)
check('bills only confirmed sessions (500 not 1250)', /₪500/.test(txt()) && !/₪1,250/.test(txt()));

// --- flow entry
await click(findAll('button',/בואי נסדר את היום/)[0],'start');
check('flow opens', /מתוך/.test(txt()));
// attendance item for x1
check('attendance step', /האם הפגישה התקיימה/.test(txt()));
await click(findAll('button',/^✖ לא הגיע/)[0],'noshow');
check('noshow recorded', store().appointments.find(a=>a.id==='x1').status==='noshow');

// --- note capture with dictation (v3.1)
check('note step with textarea', !!document.querySelector('.modal textarea'));
await setVal(document.querySelector('.modal textarea'),'סיכום בדיקה');
await click(findAll('button',/הקלטה קולית/)[0],'rec');
await click(findAll('button',/עצירת ההקלטה/)[0],'stop');
await act(async()=>{ await new Promise(r=>setTimeout(r,30)); });
check('mic released', micStopped===true);
await click(findAll('button',/שמירת הסיכום/)[0],'save note');
const n=store().appointments.find(a=>a.id==='n1');
check('note saved', n.notes==='סיכום בדיקה' && String(n.voiceNote).startsWith('data:'));

// --- payment skip (v3.0)
check('payment step', /תשלום שטרם התקבל/.test(txt()));
answers=[true];
await click(findAll('button',/לדלג על כל התשלומים/)[0],'skip');
check('payment reminders disabled', store().settings?.showPaymentReminders===false);
check('flow ends cleanly', /יום נקי/.test(txt()));
await click(findAll('button',/חזרה למסך הבית/)[0],'close');

// --- archive (v2.9)
await click(findAll('button',/מטופלים$/)[0],'patients');
await click(findAll('h3',/דנה כהן/)[0]?.closest('.card'),'open p1');
check('summaries card present (v2.7/2.8)', /סיכומי הפגישות/.test(txt()));
answers=[true,true];
await click(findAll('button',/סיום טיפול/)[0],'archive');
check('patient archived', store().patients.find(p=>p.id==='p1').archived===true);
check('archive tab appears', /ארכיון \(1\)/.test(txt()));
check('history preserved', store().appointments.filter(a=>a.patientId==='p1').length===1);
check('no NaN', !txt().includes('NaN'));
process.exit(bad?1:0);
