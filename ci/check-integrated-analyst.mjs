// v1.8.15 — synthetic integrated financial Analyst regression.
// Ensures actual paid utilities are counted once; planned budget and loan
// balances must not be misclassified as Cash Flow income or expense.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const html=readFileSync('index.html','utf8');
const script=readFileSync('analyst.js','utf8');
for(const target of ['aiAnalystOverview','aiAnalystIntegrated','aiAnalystConnected',
 'aiAnalystHighlights','aiAnalystTrend','aiAnalystBreakdown','aiAnalystAnswer']){
 assert(html.includes('id="'+target+'"'),'Missing analyst section: '+target);
}
assert.match(html,/askFinanceAnalyst\('networth'\)/);
assert.match(html,/askFinanceAnalyst\('loans'\)/);
assert.match(html,/askFinanceAnalyst\('budget'\)/);
assert.match(html,/askFinanceAnalyst\('utilities'\)/);
assert.match(html,/askFinanceAnalyst\('trend'\)/);
assert(!/fetch\s*\(|XMLHttpRequest|sendBeacon/.test(script),
  'Offline analysis must not perform network requests');
const rows=[
 {id:1,date:'2026-11-01',type:'income',amount:60000,category:'Salary',desc:'Salary'},
 {id:2,date:'2026-11-03',type:'expense',amount:10000,category:'Food',desc:'Groceries'},
 {id:'util-electric',date:'2026-11-06',type:'expense',amount:3000,
  category:'Bills & Utilities',desc:'Electricity · Home Utilities',linkedUtility:true},
 {id:'util-car',date:'2026-11-10',type:'expense',amount:1000,
  category:'Transportation',desc:'Car Fuel · Home Utilities',linkedUtility:true},
 {id:3,date:'2026-10-05',type:'income',amount:50000,category:'Salary',desc:'Salary'},
 {id:4,date:'2026-10-06',type:'expense',amount:10000,category:'Food',desc:'Groceries'}
];
const nodes=new Map();
function node(){return {innerHTML:'',textContent:'',classList:{contains:()=>false}};}
function get(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}
const budget={available:true,planningOnly:true,saved:true,
 incomeBasis:'before-loans',
 totals:{income:90000,expenses:20000,countedLoanDeduction:5000,outgoings:25000,remaining:65000}};
const ctx={
 console,window:null,globalThis:null,Date,Math,Number,Map,Set,Array,String,Intl,
 document:{getElementById:get},
 selectedDate:new Date(2026,10,1),
 formatPHP:value=>'₱'+Number(value).toFixed(2),
 RICO_GET_ALL_CASH_FLOW:()=>rows,
 RICO_CASH_FLOW_BALANCE:()=>80000,
 RICO_NET_WORTH:{
  totals:()=>({assets:100000,liabilities:40000,netWorth:60000,
   cashBalance:80000,linkedDebt:20000,linkedCount:2,skippedDuplicates:3000}),
  manualItems:()=>[
   {type:'asset',name:'Car',amount:20000},
   {type:'liability',name:'Loan X',amount:3000}
  ]
 },
 RICO_LINKED_LOANS:{
  snapshot:{asOf:'2026-11-20',fetchedAt:new Date().toISOString(),
   selected:['A','B'],loans:[{id:'A',name:'Loan A',balance:12000},{id:'B',name:'Loan B',balance:8000}]}
 },
 RICO_LINKED_BUDGET:{analysisBudget:month=>month==='2026-11'?budget:null},
 RICO_UTILITY_LINK:{connected:true,linkedRows:rows.filter(r=>r.linkedUtility)}
};
ctx.window=ctx;ctx.globalThis=ctx;
new Script(script,{filename:'analyst.js'}).runInContext(createContext(ctx));
assert.ok(ctx.RICO_ANALYST_TEST,'Testable analytics interface must be exposed');
let now=ctx.RICO_ANALYST_TEST.snapshot(ctx.selectedDate);
assert.equal(now.income,60000);
assert.equal(now.expense,14000,'Utilities included once in actual expenses');
assert.equal(now.net,46000,'Loan balances and plans must not enter Cash Flow');
assert.equal(now.utilityPaid,4000);
assert.equal(now.utilityCount,2);
let info=ctx.RICO_ANALYST_TEST.integrated(ctx.selectedDate);
assert.equal(info.worth.assets,100000);
assert.equal(info.worth.liabilities,40000);
assert.equal(info.worth.netWorth,60000);
assert.equal(info.loanTotal,20000);
assert.equal(info.loans.length,2);
assert.equal(info.budget.totals.remaining,65000);
const history=ctx.RICO_ANALYST_TEST.lastSix(ctx.selectedDate);
assert.equal(history.observed,2);
assert.equal(history.average,12000);
ctx.renderFinanceAnalyst();
assert.match(get('aiAnalystOverview').innerHTML,/₱46000\.00/);
assert.match(get('aiAnalystIntegrated').innerHTML,/₱60000\.00/);
assert.match(get('aiAnalystConnected').innerHTML,/₱65000\.00/);
assert.match(get('aiAnalystConnected').innerHTML,/₱4000\.00/);
assert.match(get('aiAnalystHighlights').innerHTML,/Paid Home Utilities included/);
assert.match(get('aiAnalystBreakdown').innerHTML,/Loan A/);
assert.match(get('aiAnalystBreakdown').innerHTML,/Electricity/);
ctx.askFinanceAnalyst('budget');
assert.match(get('aiAnalystAnswer').textContent,/Actual expenses recorded here are ₱14000\.00/);
assert.match(get('aiAnalystAnswer').textContent,/different scopes/);
ctx.askFinanceAnalyst('loans');
assert.match(get('aiAnalystAnswer').textContent,/₱20000\.00/);
ctx.askFinanceAnalyst('utilities');
assert.match(get('aiAnalystAnswer').textContent,/2 linked paid/);
ctx.askFinanceAnalyst('networth');
assert.match(get('aiAnalystAnswer').textContent,/₱60000\.00/);
ctx.askFinanceAnalyst('trend');
assert.match(get('aiAnalystAnswer').textContent,/₱12000\.00/);
// When a different month is selected the Analyst does not present November's
// household budget as if it applied to October.
ctx.selectedDate=new Date(2026,9,1);
ctx.renderFinanceAnalyst();
assert.match(get('aiAnalystConnected').innerHTML,/Not linked/);
assert.match(get('aiAnalystOverview').innerHTML,/₱40000\.00/);
// A missing connection must not cause a crash or invent linked values.
ctx.RICO_LINKED_LOANS.snapshot=null;
ctx.RICO_NET_WORTH=null;
ctx.RICO_LINKED_BUDGET=null;
ctx.RICO_UTILITY_LINK=null;
ctx.renderFinanceAnalyst();
assert.match(get('aiAnalystIntegrated').innerHTML,/N\/A/);
assert.match(get('aiAnalystConnected').innerHTML,/Not linked/);
// Malicious free-text from a transaction must be encoded before HTML insertion.
rows.push({id:6,date:'2026-10-21',type:'expense',amount:3000,
 category:'<img src=x onerror=alert(1)>',desc:'<script>bad()</script>'});
ctx.renderFinanceAnalyst();
assert(!get('aiAnalystHighlights').innerHTML.includes('<img'));
assert(!get('aiAnalystBreakdown').innerHTML.includes('<script>'));
console.log('PASS: integrated offline Analyst, Net Worth, selected loans, budget plan, paid utility dedupe, six-month trends, source gaps and safe rendering');
