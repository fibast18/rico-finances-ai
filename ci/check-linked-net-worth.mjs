// Regression: iPhone reload from an offline cached loan snapshot must update
// top Total Debts and Net Worth before any network request succeeds.
// All fixture amounts and names are synthetic, never user financial records.
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import assert from 'node:assert/strict';

const records=[
 {id:'a-asset',type:'asset',name:'Test Savings',category:'Cash / Bank',amount:500},
 {id:'manual-a',type:'liability',name:'Test Loan A',category:'Personal Loan',amount:75},
 {id:'manual-extra',type:'liability',name:'Separate Debt',category:'Other Debt',amount:50}
];
const loans=[
 {id:'A',name:'Test Loan A',balance:100},
 {id:'B',name:'Test Loan B',balance:200}
];
const stored=new Map([
 ['rico_finances_ai_net_worth_v1',JSON.stringify(records)],
 ['rico_finances_ai_loan_read_code_v1','rfnw_'+'a'.repeat(43)],
 ['rico_finances_ai_loan_snapshot_v1',JSON.stringify({
  loans,source:'pono-family-loan-tracker',asOf:'2026-11-21',
  fetchedAt:'2026-11-21T00:00:00.000Z',selected:['A','B']
 })]
]);
const listeners=new Map(),nodes=new Map();
function element(){
 const handlers=new Map();
 return {
  hidden:false,disabled:false,value:'',textContent:'',title:'',tabIndex:0,children:[],
  classList:{toggle(){},add(){},remove(){}},
  addEventListener:(type,cb)=>handlers.set(type,cb),
  dispatch:(type,event={})=>handlers.get(type)?.(event),
  setAttribute(){},replaceChildren(...x){this.children=x},
  append(...x){this.children.push(...x)},add(){},focus(){},reset(){},
  getAttribute(){return null}
 };
}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}
const context={
 window:null,document:{
  readyState:'loading',
  getElementById:get,createElement:element,body:{classList:{add(){},remove(){}}},
  addEventListener(type,cb){const a=listeners.get(type)||[];a.push(cb);listeners.set(type,a);}
 },
 localStorage:{
  getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),
  removeItem:k=>stored.delete(k)
 },
 navigator:{onLine:false},console,Intl,Date,Number,String,Array,Math,Map,Set,
 URL,File:class{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},confirm:()=>true,alert:()=>{},
 crypto:{randomUUID:()=> 'synthetic-id'},
 addEventListener(){},scrollTo(){},location:{origin:'https://fibast18.github.io'},
};
context.window=context;
context.globalThis=context;
const vm=createContext(context);
for(const file of ['net-worth-v1.8.15.js','linked-loans-v1.8.15.js']){
 new Script(readFileSync(file,'utf8'),{filename:file}).runInContext(vm);
}
assert.equal(context.RICO_NET_WORTH.version,context.RICO_LINKED_LOANS.version,'Related modules must match');
for(const cb of listeners.get('DOMContentLoaded')||[])cb();
let result=context.RICO_NET_WORTH.totals();
assert.equal(result.assets,500);
assert.equal(result.liabilities,350,'Manual loan A replaced by synced A; separate debt retained');
assert.equal(result.netWorth,150,'Linked loans must enter Net Worth immediately from cached snapshot');
assert.equal(result.skippedDuplicates,75);
assert.match(get('netWorthLiabilities').textContent,/350/);
assert.match(get('netWorthTotal').textContent,/150/);
assert.equal(JSON.parse(stored.get('rico_finances_ai_net_worth_v1')).length,3,'Manual ledger unchanged');
// Checkbox toggle updates summary instantly.
const list=get('loanLinkItems');
assert.equal(list.children.length,2,'Both linked loans rendered');
list.children[0].children[0].checked=false;
list.children[0].children[0].dispatch('change');
result=context.RICO_NET_WORTH.totals();
assert.equal(result.liabilities,325,'Unchecking linked A restores manual A while B stays included');
assert.equal(result.netWorth,175);
assert.equal(JSON.parse(stored.get('rico_finances_ai_net_worth_v1')).length,3);
assert.deepEqual(JSON.parse(stored.get('rico_finances_ai_net_worth_v1')).map(x=>x.category),
 ['Cash / Bank','Personal Loan','Other Debt'],'Legacy Net Worth categories must be preserved');
console.log('PASS: offline cached balances, live linked selection, manual duplicate protection and Net Worth summary');
