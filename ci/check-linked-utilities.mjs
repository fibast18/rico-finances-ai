// Synthetic integration: paid utility rows flow into Cash Flow exactly once.
// Checks read-only Firestore client, local duplicate protection, and manual data safety.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const manual=[
 {id:1,type:'expense',date:'2026-11-10',amount:1899.35,
  category:'Bills & Utilities',desc:'Electricity bill LEYECO'},
 {id:2,type:'income',date:'2026-11-01',amount:20000,
  category:'Salary / Wages',desc:'Test wages'},
 {id:3,type:'expense',date:'2026-11-15',amount:50,
  category:'Food & Dining',desc:'Separate snack'}
];
const db={
 schema:1,source:'rico-utility-monitor',dateBasis:'bill-or-record-date',
 updatedAt:'2026-11-21T00:00:00.000Z',
 entries:[
  {id:'electricity:paid-a',type:'electricity',date:'2026-11-10',amount:1899.35},
  {id:'lpg:paid-b',type:'lpg',date:'2026-11-14',amount:1000},
  {id:'camella:hoa-c',type:'camella',date:'2026-11-15',amount:300}
 ]
};
const saved=new Map([
 ['rico_finances_utility_paid_snapshot_v1',JSON.stringify(db)],
 ['rico_finances_ai_txs',JSON.stringify(manual)]
]);
const nodes=new Map(),events=new Map();
function element(){
 const handlers=new Map();
 return {
  textContent:'',checked:false,hidden:false,children:[],
  classList:{toggle(){},add(){},remove(){}},
  setAttribute(){},append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items},
  addEventListener:(event,handler)=>handlers.set(event,handler),
  dispatch:(event)=>handlers.get(event)?.()
 };
}
const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
const add=(name,handler)=>{const xs=events.get(name)||[];xs.push(handler);events.set(name,xs);};
let rendered=0;
const context={
 window:null,document:{readyState:'loading',hidden:false,getElementById:get,createElement:element,
  addEventListener:add},
 navigator:{onLine:false},console,Intl,Date,Number,String,Math,Set,Map,Array,Object,Promise,
 localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
 addEventListener:add,confirm:()=>true,fetch(){throw Error('No Firebase fetch allowed in read-only offline unit test.');}
};
context.window=context;
context.RICO_MANUAL_CASH_FLOW=()=>manual.slice();
context.RICO_RENDER_CASH_FLOW=()=>{rendered++;};
new Script(readFileSync('linked-utilities-v1.8.12.js','utf8'),
 {filename:'linked-utilities-v1.8.12.js'}).runInContext(createContext(context));
for(const h of events.get('DOMContentLoaded')||[])h();
const link=context.RICO_UTILITY_LINK;
assert.equal(link.linkedRows.length,3);
let effective=link.merge(manual);
assert.equal(effective.length,5,'One matching manual electricity entry excluded, two other linked expenses added');
assert.equal(effective.filter(x=>x.linkedUtility).length,3);
assert.equal(effective.filter(x=>x.id===1).length,0,'Matching manual entry hidden but not erased');
assert.equal(effective.reduce((s,x)=>s+(x.type==='income'?x.amount:-x.amount),0),16750.65);
assert.equal(link.totals(manual).duplicateManual,1);
assert.equal(saved.get('rico_finances_ai_txs'),JSON.stringify(manual),'Manual Cash Flow key must remain untouched');
assert.equal(get('utilityLinkRows').children.length,3);
get('utilityLinkRows').children[2].children[0].checked=false;
get('utilityLinkRows').children[2].children[0].dispatch('change');
effective=link.merge(manual);
assert.equal(effective.some(x=>x.id===1),true,'Original manual expense restored when linked bill deselected');
assert.equal(effective.filter(x=>x.linkedUtility).length,2);
assert.equal(link.totals(manual).duplicateManual,0);
assert.ok(rendered>0,'Cash Flow should recalculate after source selection changes');
// Source removes a paid row or marks it unpaid -> published snapshot no longer contains it.
const revised={...db,entries:db.entries.filter(x=>x.type!=='lpg'),updatedAt:'2026-11-21T01:00:00.000Z'};
link.acceptSnapshot(revised);
assert.equal(link.linkedRows.length,2);
assert.equal(saved.get('rico_finances_ai_txs'),JSON.stringify(manual),'Firebase sync never writes Cash Flow localStorage');
assert.equal(JSON.parse(saved.get('rico_finances_utility_paid_snapshot_v1')).entries.length,2);
const code=readFileSync('linked-utilities-v1.8.12.js','utf8');
assert(code.includes("db.onSnapshot(ref"),'Firebase real-time event subscription missing');
assert(!code.includes('db.setDoc(')&&!code.includes('db.updateDoc(')&&!code.includes('db.deleteDoc('),
 'Finances must not write any utility records');
console.log('PASS: paid-only utilities, exact manual duplicate avoidance, selection, snapshot updates and no financial writes');
