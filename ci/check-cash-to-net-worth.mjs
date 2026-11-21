// Regression: Net Worth receives the SAME live running cash-flow balance,
// without copying it into manual asset storage or double counting a matching cash item.
// Test inputs are synthetic; no real user financial data is included.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const html=readFileSync('index.html','utf8');
const getter=/function currentCashFlowBalance\(\) \{[\s\S]*?\n\}\nwindow\.RICO_CASH_FLOW_BALANCE=currentCashFlowBalance;/;
const matched=html.match(getter);
assert(matched,'Missing shared Cash Flow balance calculation and window binding');
assert.match(html,/function renderApp\(\) \{[\s\S]*?window\.RICO_NET_WORTH\?\.render\?\.\(\);/,'Cash Flow mutation must refresh Net Worth');

const records=[
 {id:'manual-house',type:'asset',name:'Test House',category:'Property / Land',amount:552000},
 {id:'manual-cash',type:'asset',name:'Cash on Hand / Balance',category:'Cash on Hand',amount:120},
 {id:'manual-debt',type:'liability',name:'Separate Debt',category:'Other Debt',amount:300}
];
const original=JSON.stringify(records);
const stored=new Map([['rico_finances_ai_net_worth_v1',original]]);
const txs=[
 {type:'income',amount:1000,category:'Salary'},
 {type:'expense',amount:250,category:'Food'}
];
const nodes=new Map(),events=new Map();
function node() {
 const handlers=new Map();
 return {
  textContent:'',value:'',hidden:false,disabled:false,checked:false,tabIndex:0,
  children:[],classList:{toggle(){},add(){},remove(){}},
  setAttribute(){},addEventListener:(name,cb)=>handlers.set(name,cb),
  append(...elements){this.children.push(...elements)},
  replaceChildren(...elements){this.children=elements},
  add(){},focus(){},reset(){},dispatch:(name)=>handlers.get(name)?.()
 };
}
function get(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}
const ctx={
 window:null,globalThis:null,transactions:txs,console,Math,Number,Intl,Date,Array,Set,Map,
 localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
 document:{readyState:'loading',body:{classList:{add(){},remove(){}}},
  getElementById:get,createElement:node,addEventListener:(name,cb)=>{
   const a=events.get(name)||[];a.push(cb);events.set(name,a);
  }},
 navigator:{},crypto:{randomUUID:()=> 'synthetic-new-id'},
 addEventListener(){},scrollTo(){},alert(){},confirm:()=>true,
 setTimeout,clearTimeout,File:class{},URL
};
ctx.window=ctx;ctx.globalThis=ctx;
const vm=createContext(ctx);
new Script(matched[0],{filename:'Cash Flow shared balance getter'}).runInContext(vm);
new Script(readFileSync('net-worth-v1.8.10.js','utf8'),{filename:'net-worth-v1.8.10.js'}).runInContext(vm);
for(const handler of events.get('DOMContentLoaded')||[])handler();
const getTotals=()=>ctx.RICO_NET_WORTH.totals();
let t=getTotals();
assert.equal(ctx.RICO_CASH_FLOW_BALANCE(),750);
assert.equal(t.cashBalance,750);
assert.equal(t.assets,552750);
assert.equal(t.liabilities,300);
assert.equal(t.netWorth,552450);
assert.equal(t.skippedDuplicateCash,120,'Exact manually entered Cash on Hand / Balance must not be double counted');
const assetRows=get('netWorthAssetList').children;
assert.equal(assetRows.length,3,'One automatic cash row and two existing manual assets');
assert.equal(assetRows[0].children[0].children[0].textContent,'Cash on Hand / Balance');
assert.equal(assetRows[0].children[2].textContent,'AUTO');
assert.equal(assetRows[0].children[1].textContent.includes('750'),true);
assert.equal(assetRows[1].children[2].children.length,2,'Manual rows have two icon actions');
assert.match(assetRows[1].children[2].children[0].innerHTML,/<svg/);
assert.match(assetRows[1].children[2].children[1].innerHTML,/<svg/);
assert.equal(assetRows[1].children[2].children[0].textContent,'','Edit/Delete text replaced with icons');
assert.equal(get('netWorthAssetCount').textContent,'2 manual + 1 auto');
assert.equal(stored.get('rico_finances_ai_net_worth_v1'),original,'Cash row never written to localStorage');

txs.push({type:'expense',amount:200});
ctx.RICO_NET_WORTH.render();
t=getTotals();
assert.equal(t.cashBalance,550);
assert.equal(t.assets,552550,'Cash Flow entry change increases or decreases automatic asset without manual entry');
assert.equal(t.netWorth,552250);
assert.equal(get('netWorthAssetList').children[0].children[1].textContent.includes('550'),true);

txs.push({type:'expense',amount:700});
ctx.RICO_NET_WORTH.render();
t=getTotals();
assert.equal(t.cashBalance,-150);
assert.equal(t.cashAsset,0,'Negative cash is not labeled a positive asset');
assert.equal(t.cashDeficit,150,'Negative running cash balance becomes an estimated deficit');
assert.equal(t.assets,552000);
assert.equal(t.liabilities,450);
assert.equal(t.netWorth,551550);
const debtRows=get('netWorthLiabilityList').children;
assert.equal(debtRows[0].children[0].children[0].textContent,'Cash Flow deficit');
assert.equal(debtRows[0].children[2].textContent,'AUTO');
assert.equal(stored.get('rico_finances_ai_net_worth_v1'),original,'All manual records and categories stay unchanged');
console.log('PASS: cash-flow-to-asset live balance, deficit handling, duplicate protection, compact icon controls, and unchanged storage');
