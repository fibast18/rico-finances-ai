// End-to-end synthetic integration test for 30-second visible auto sync.
// Verify ONE secure request updates BOTH loans and budget without manual refresh.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const stored=new Map([['rico_finances_ai_loan_read_code_v1','rfnw_'+'z'.repeat(43)]]);
const nodes=new Map(),events=new Map(),timers=[];
let tickTime=Date.now(),requests=[],renders=0;
function node(){
 const callbacks=new Map();
 return {
  textContent:'',value:'',hidden:false,disabled:false,checked:false,children:[],
  classList:{toggle(){},add(){},remove(){}},
  addEventListener(type,cb){callbacks.set(type,cb)},
  dispatch(type){callbacks.get(type)?.()},
  append(...args){this.children.push(...args)},
  replaceChildren(...args){this.children=args},
  setAttribute(){},focus(){}
 };
}
function get(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}
const on=(name,cb)=>{const a=events.get(name)||[];a.push(cb);events.set(name,a)};
get('selectedMonthDisplay').textContent='November 2026';
const FakeDate=class extends Date { static now(){return tickTime;} };
const ctx={
 window:null,globalThis:null,Promise,Map,Set,Math,Number,String,Intl,URL,Date:FakeDate,console,
 navigator:{onLine:true},
 document:{
  readyState:'loading',hidden:false,getElementById:get,createElement:node,
  addEventListener:on
 },
 localStorage:{
  getItem:k=>stored.get(k)??null,
  setItem:(k,v)=>stored.set(k,v),
  removeItem:k=>stored.delete(k)
 },
 addEventListener:on,confirm:()=>true,
 setInterval:(cb,ms)=>{timers.push({cb,ms});return timers.length},
 MutationObserver:class {observe(){}},
 fetch:async(url,options)=>{
  requests.push({url,options});
  const index=requests.length,month=new URL(url).searchParams.get('month');
  const loanA=index===1?100:70, ordinary=index===1?8000:11000;
  return {ok:true,json:async()=>({
   source:'pono-family-loan-tracker',asOf:'2026-11-21',updatedAt:'2026-11-21T10:00:00Z',version:index,
   loans:[{id:'A',name:'Test Loan A',balance:loanA},{id:'B',name:'Test Loan B',balance:200}],
   budget:{month,available:true,saved:true,planningOnly:true,incomeBasis:'before-loans',
    incomes:[{name:'Household salary',amount:59000}],
    expenses:[{name:'Food',amount:ordinary}],loanDeduction:2000,
    totals:{income:59000,expenses:ordinary,countedLoanDeduction:2000,
     outgoings:ordinary+2000,remaining:59000-ordinary-2000}
   }
  })}
 }
};
ctx.window=ctx;ctx.globalThis=ctx;
ctx.RICO_NET_WORTH={manualItems:()=>[],render:()=>{renders++;ctx.RICO_LINKED_LOANS?.render()}};
const vm=createContext(ctx);
for(const file of ['linked-loans-v1.8.13.js','linked-budget-v1.8.13.js'])
 new Script(readFileSync(file,'utf8'),{filename:file}).runInContext(vm);
assert.equal(ctx.RICO_LINKED_LOANS.autoSyncMs,30000);
assert.equal(timers.length,0,'No timer before DOM ready');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
for(const listener of events.get('DOMContentLoaded')||[])listener();
await flush();
assert.equal(requests.length,1,'Initial sync must be a single combined request');
assert.match(requests[0].url,/\?month=2026-11$/);
assert.equal(requests[0].options.headers.Authorization,'Bearer rfnw_'+'z'.repeat(43));
assert.equal(ctx.RICO_LINKED_LOANS.balanceDetails([]).amount,300);
assert.match(get('linkedBudgetRemaining').textContent,/49,000/);
assert.equal(timers.length,1,'One 30-second scheduled poll is installed');
tickTime+=31000;timers[0].cb();
await flush();
assert.equal(requests.length,2,'One combined automatic request per poll');
assert.equal(ctx.RICO_LINKED_LOANS.balanceDetails([]).amount,270);
assert.match(get('linkedBudgetRemaining').textContent,/46,000/,'Budget changes in same poll');
assert.match(get('loanLinkIncludedTotal').textContent,/270/,'Loan subtotal automatically updates');
assert.ok(renders>=2,'Net Worth summary rerenders when linked figures change');
// No request when hidden, because iPhone may suspend the web app.
ctx.document.hidden=true;tickTime+=31000;timers[0].cb();
await flush();assert.equal(requests.length,2,'Background sync should pause');
// Resume performs an immediate sync, even before another 30 seconds.
ctx.document.hidden=false;
for(const cb of events.get('visibilitychange')||[])cb();
await flush();assert.equal(requests.length,3,'Foreground resume immediately resyncs');
assert.equal(stored.has('rico_finances_ai_net_worth_v1'),false,'Manual Net Worth storage unchanged');
assert.equal(stored.has('rico-finances-ai-data'),false,'Cash Flow storage unchanged');
// Disconnect removes only linked caches and does not alter other records.
ctx.RICO_LINKED_BUDGET.disconnect();
assert.equal(stored.has('rico_finances_ai_monthly_budget_cache_v1'),false);
console.log('PASS: one 30-second request updates both cards, pauses hidden, resumes immediately, keeps local ledgers intact');
