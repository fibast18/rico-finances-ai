import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const stores=new Map(),window={},document={readyState:'loading',getElementById:()=>null,addEventListener:()=>{}};
const localStorage={getItem:k=>stores.get(k)??null,setItem:(k,v)=>stores.set(k,v)};
window.RICO_GET_ALL_CASH_FLOW=()=>[
 {date:'2026-01-03',type:'income',amount:30000},{date:'2026-01-04',type:'expense',amount:10000},
 {date:'2026-02-02',type:'income',amount:30000},{date:'2026-02-03',type:'expense',amount:12000},
 {date:'2026-03-01',type:'expense',amount:2000},{date:'2026-03-01',type:'liability',amount:90000},
 {date:'bad',type:'expense',amount:9000}];
window.RICO_NET_WORTH={totals:()=>({assets:100000,liabilities:25000,netWorth:75000})};
runInNewContext(readFileSync('financial-planning.js','utf8'),{window,document,localStorage,Intl,Date,Number,Array,String,JSON,Math,Set,Error,RegExp});
const p=window.RICO_FINANCIAL_PLAN;assert(p);
assert.equal(p.summarize('2026-01').net,20000);
assert.equal(p.summarize('2026-03').expense,2000);
assert.equal(p.annual(2026).income,60000);
assert.equal(p.annual(2026).expense,24000);
assert(p.csv(2026).includes('TOTAL,60000.00,24000.00,36000.00'));
assert.equal(p.forecast(new Date(2026,2,10)).available,true);
assert.equal(p.forecast(new Date(2025,0,10)).available,false);
assert.equal(p.validate({reserve:12000,essential:4000,goals:[],snapshots:[]}).reserve,12000);
assert.throws(()=>p.validate({reserve:-1,essential:0,goals:[],snapshots:[]}));
assert(p.alerts(new Date(2026,2,10)).some(x=>x[0]==='red'));
console.log('PASS: six financial planning modules and calculations');