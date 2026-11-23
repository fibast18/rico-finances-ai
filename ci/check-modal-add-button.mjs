/* Regression: the global Add button must hide behind BOTH modal entry sheets. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const html=readFileSync('index.html','utf8');
const networth=readFileSync('net-worth-v1.8.15.js','utf8');
const netcss=readFileSync('net-worth.css','utf8');
assert.match(html,/body\.transaction-modal-open \.floating-add-btn,body\.nw-modal-open \.floating-add-btn\{display:none!important\}/);
assert.match(html,/<button id="addTransactionButton"/);
assert.match(networth,/document\.body\.classList\.add\('nw-modal-open'\)/);
assert.match(networth,/document\.body\.classList\.remove\('nw-modal-open'\)/);
assert.match(netcss,/#addTransactionButton\[hidden\]\{display:none!important\}/);
const start=html.indexOf('let transactionModalCloseTimer = null;');
const end=html.indexOf('function setTxType(type)',start);
assert(start>0&&end>start,'Transaction sheet lifecycle hooks not found');
const classSet=(...initial)=>{
 const s=new Set(initial);
 return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)};
};
const modal={classList:classSet('hidden','opacity-0'),children:[{classList:classSet('translate-y-full')}]};
const form={reset(){}},editing={value:'1'},date={value:''};
const controls={transactionModal:modal,txForm:form,editingTxId:editing,txDate:date};
const body={classList:classSet()};
const scheduled=new Map();let nextId=0;
const ctx={
 document:{body,getElementById:id=>controls[id]},
 setTimeout:(fn,ms)=>{const id=++nextId;scheduled.set(id,{fn,ms});return id;},
 clearTimeout:id=>scheduled.delete(id),
 todayLocal:()=> '2026-11-23',
 setTxType:()=>{},
 lucide:{createIcons(){}}
};
new Script(html.slice(start,end),{filename:'transaction-sheet-lifecycle.js'}).runInContext(createContext(ctx));
ctx.showModal();
assert(body.classList.contains('transaction-modal-open'),'FAB should hide as entry form opens');
assert(!modal.classList.contains('hidden'));
ctx.closeModal();
assert(body.classList.contains('transaction-modal-open'),'FAB must remain hidden during close animation');
const firstClose=[...scheduled.values()].find(x=>x.ms===300);
assert(firstClose,'Modal closing timer missing');
firstClose.fn();
assert(!body.classList.contains('transaction-modal-open'),'FAB should return after sheet closes');
assert(modal.classList.contains('hidden'));
ctx.showModal();ctx.closeModal();ctx.showModal();
for(const task of scheduled.values())if(task.ms===300)assert.fail('Reopened sheet must cancel pending close');
assert(body.classList.contains('transaction-modal-open'),'FAB should stay hidden if sheet reopens');
console.log('PASS: Add button hidden on transaction and Net Worth sheets, restored on close, safe rapid reopen');
