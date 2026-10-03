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
window.alert=()=>{}; window.confirm=()=>true;
const d=new Date(); const pad=n=>String(n).padStart(2,'0');
const loc=x=>`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
const day=n=>loc(new Date(d.getTime()-n*864e5)); const fut=n=>loc(new Date(d.getTime()+n*864e5));
window.localStorage.setItem('clinic_data_v1',JSON.stringify({schemaVersion:2, settings:{showPaymentReminders:true},
 patients:[{id:'p1',name:'דנה כהן',sessionRate:300,payerType:'private'}],
 appointments:[
  {id:'s1',patientId:'p1',date:day(2),startTime:'10:00',duration:50,status:'scheduled',paid:false},
  {id:'s2',patientId:'p1',date:day(1),startTime:'15:00',duration:50,status:'scheduled',paid:false}],
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

// --- reminders card no longer contradicts itself
const card=[...document.querySelectorAll('h3')].find(h=>/תזכורות/.test(h.textContent)).closest('.card');
check('no "no reminders" text when items wait', !/אין תזכורות כרגע/.test(card.textContent));
check('header count matches flow (2)', /תזכורות \(2\)/.test(card.querySelector('h3').textContent) && /יש 2 דברים/.test(card.textContent));
check('card highlighted', /gold|rose/.test(card.getAttribute('style')||''));

// --- move button next to הגיע / לא הגיע in the inbox
const moveBtns=findAll('button',/תאריך אחר$/);
check('one move button per pending session', moveBtns.length===2);
const row=moveBtns[0].parentElement;
check('sits beside הגיע and לא הגיע', /הגיע/.test(row.textContent) && /לא הגיע/.test(row.textContent));

// open it -> same picker as the flow
await click(moveBtns[0],'open move');
check('picker modal opened', /לאיזה תאריך ושעה הפגישה עברה/.test(txt()));
check('row click did not open appt editor', !/עריכת פגישה/.test(txt()));

// move to the future -> stays scheduled, leaves the inbox
await setVal(document.querySelector('.modal input[type="date"]'),fut(5));
await click(findAll('.modal button',/קביעה למועד החדש/)[0],'save');
const moved=store().appointments.find(a=>a.id===(moveBtns.length&&'s2'));
const any=store().appointments.filter(a=>a.date===fut(5));
check('one session moved to the future date', any.length===1 && any[0].status==='scheduled');
check('modal closed', !/לאיזה תאריך ושעה/.test(txt()));
check('inbox now shows one pending', findAll('button',/תאריך אחר$/).length===1);

// move to the past with confirmation -> completed
await click(findAll('button',/תאריך אחר$/)[0],'open2');
await setVal(document.querySelector('.modal input[type="date"]'),day(4));
await click(findAll('.modal button',/כן, הגיע/)[0],'confirm');
check('past move confirmed as completed', store().appointments.some(a=>a.date===day(4)&&a.status==='completed'));
check('inbox empty', findAll('button',/תאריך אחר$/).length===0);
const c2=[...document.querySelectorAll('h3')].find(h=>/תזכורות/.test(h.textContent)).closest('.card');
const hc=(c2.querySelector('h3').textContent.match(/\((\d+)\)/)||[])[1], bc=(c2.textContent.match(/יש (\d+) דברים/)||[])[1];
check('confirmed session spawns its follow-ups (payment + summary), counts agree', hc==='2' && bc==='2' && /סיכום פגישה/.test(c2.textContent));
check('still no contradictory empty message', !/אין תזכורות כרגע/.test(c2.textContent));
check('no NaN', !txt().includes('NaN'));
process.exit(bad?1:0);
