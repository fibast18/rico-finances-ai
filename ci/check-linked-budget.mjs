// Synthetic fixture only: the family-budget link is read-only and separate
// from the actual transaction ledger and Net Worth entries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const stored=new Map([
 ['rico_finances_ai_loan_read_code_v1','rfnw_'+'b'.repeat(43)],
 ['rico_finances_ai_net_worth_v1',JSON.stringify([{id:'dummy-a',type:'asset',name:'Test asset',category:'Cash / Bank',amount:500}])],
 ['rico_finances_ai_monthly_budget_cache_v1',JSON.stringify({
  '2026-11':{at:'2026-11-21T10:00:00.000Z',budget:{
   month:'2026-11',available:true,saved:true,planningOnly:true,incomeBasis:'before-loans',
   incomes:[{name:'Salary',amount:59000}],expenses:[{name:'Food',amount:8000}],
   loanDeduction:2000,totals:{income:59000,expenses:8000,
    countedLoanDeduction:2000,outgoings:10000,remaining:49000}
  }}
 })]
]);
const nodes=new Map(),listeners=new Map(),requests=[];
function element(){
 const handlers=new Map();
 return {
  textContent:'',value:'',hidden:false,disabled:false,children:[],classList:{toggle(){}},
  addEventListener(type,handler){handlers.set(type,handler)},
  dispatch(type){handlers.get(type)?.()},replaceChildren(...x){this.children=x},
  append(...x){this.children.push(...x)},setAttribute(){}
 };
}
function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}
get('selectedMonthDisplay').textContent='November 2026';
const ctx={
 console,Intl,Date,Number,Math,Map,Set,Array,String,Object,Promise,
 navigator:{onLine:false},
 localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
 document:{readyState:'loading',getElementById:get,createElement:element,
  addEventListener(type,cb){const v=listeners.get(type)||[];v.push(cb);listeners.set(type,v);}},
 addEventListener(){},fetch:async (url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>({
   source:'pono-family-loan-tracker',
   budget:{
    month:'2026-11',available:true,saved:true,planningOnly:true,incomeBasis:'after-loans',
    incomes:[{name:'Take-home',amount:59000}],expenses:[{name:'Food',amount:8000}],
    loanDeduction:2000,
    totals:{income:59000,expenses:8000,countedLoanDeduction:0,outgoings:8000,remaining:51000}
   }
  })};
 }
};
ctx.window=ctx;
new Script(readFileSync('linked-budget-v1.8.10.js','utf8'),
 {filename:'linked-budget-v1.8.10.js'}).runInContext(createContext(ctx));
for(const cb of listeners.get('DOMContentLoaded')||[])cb();
assert.equal(requests.length,0,'Offline cached budget must not make network requests');
assert.equal(get('linkedBudgetContent').hidden,false);
assert.match(get('linkedBudgetIncome').textContent,/59,000/);
assert.match(get('linkedBudgetExpenses').textContent,/8,000/);
assert.match(get('linkedBudgetDeductions').textContent,/2,000/);
assert.match(get('linkedBudgetRemaining').textContent,/49,000/);
assert.match(ctx.RICO_LINKED_BUDGET.aiSummary(),/PLAN, NOT ACTUAL TRANSACTIONS/);
const oldLedger=stored.get('rico_finances_ai_net_worth_v1');
ctx.navigator.onLine=true;
await ctx.RICO_LINKED_BUDGET.refresh(true);
assert.equal(requests.length,1);
assert.match(requests[0].url,/\?month=2026-11$/);
assert.equal(requests[0].options.headers.Authorization,'Bearer rfnw_'+'b'.repeat(43));
assert.match(get('linkedBudgetRemaining').textContent,/51,000/,'After-loan income must not deduct loans twice');
assert.match(get('linkedBudgetDeductions').textContent,/0\.00/);
assert.equal(stored.get('rico_finances_ai_net_worth_v1'),oldLedger,'Net Worth records untouched');
stored.delete('rico_finances_ai_loan_read_code_v1');
ctx.RICO_LINKED_BUDGET.disconnect();
assert.equal(get('linkedBudgetContent').hidden,true);
assert.equal(stored.has('rico_finances_ai_monthly_budget_cache_v1'),false,
 'Disconnected app should remove offline family budget snapshots');
console.log('PASS: offline family budget, read-only authorized monthly refresh, no double counting, and disconnect cleanup');
