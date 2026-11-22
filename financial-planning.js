/* Rico Finances AI v1.8.18. Offline financial planning, separate from actual records. */
(()=>{'use strict';
const KEY='rico_finances_ai_planning_v1',HISTORY='rico-fin-health-history-v1',$=id=>document.getElementById(id);
const php=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
const ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const clean=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n!==''&&n!==null&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=1e12;
const empty=()=>({reserve:0,essential:0,goals:[],snapshots:[]});
function validate(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||!money(s.reserve)||!money(s.essential)||!Array.isArray(s.goals)||s.goals.length>100||!Array.isArray(s.snapshots)||s.snapshots.length>240)throw Error('Invalid financial planning backup.');
 const goals=s.goals.map(g=>{
  if(!g||typeof g.id!=='string'||g.id.length>100||!g.id||typeof g.name!=='string'||!g.name.trim()||g.name.length>80||!money(g.target)||Number(g.target)<=0||!money(g.saved)||typeof g.deadline!=='string'||(g.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)))throw Error('Invalid financial goal.');
  return {id:g.id,name:g.name.trim(),target:Number(g.target),saved:Number(g.saved),deadline:g.deadline};
 });
 if(new Set(goals.map(g=>g.id)).size!==goals.length)throw Error('Duplicate goal ID.');
 const snapshots=s.snapshots.map(x=>{
  if(!x||typeof x.month!=='string'||!/^\d{4}-\d{2}$/.test(x.month)||!['assets','liabilities','netWorth'].every(k=>typeof x[k]==='number'&&Number.isFinite(x[k])&&Math.abs(x[k])<=1e15))throw Error('Invalid Net Worth history.');
  return {month:x.month,assets:x.assets,liabilities:x.liabilities,netWorth:x.netWorth};
 });
 return {reserve:Number(s.reserve),essential:Number(s.essential),goals,snapshots};
}
let state=empty(),loadError='';
try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}catch{loadError='Planning data could not be read. Restore your backup before editing.';}
function save(next){if(loadError)throw Error(loadError);const valid=validate(next);localStorage.setItem(KEY,JSON.stringify(valid));state=valid;render();}
function rows(){try{const data=window.RICO_GET_ALL_CASH_FLOW?.();return Array.isArray(data)?data:[];}catch{return [];}}
function summarize(m){
 let income=0,expense=0,count=0;
 if(!/^\d{4}-\d{2}$/.test(m))return {income,expense,net:0,count};
 for(const t of rows()){
  if(!t||typeof t.date!=='string'||t.date.slice(0,7)!==m||!/^\d{4}-\d{2}-\d{2}$/.test(t.date))continue;
  const amount=Number(t.amount);if(!Number.isFinite(amount)||amount<=0)continue;
  if(t.type==='income'){income+=amount;count++;}
  else if(t.type==='expense'){expense+=amount;count++;}
 }
 return {income,expense,net:income-expense,count};
}
function historic(date,type){
 const data=[1,2,3].map(i=>summarize(ym(new Date(date.getFullYear(),date.getMonth()-i,1)))).filter(x=>x.count);
 return data.length?{months:data.length,average:data.reduce((a,x)=>a+x[type],0)/data.length}:null;
}
function forecast(date=new Date()){
 const current=summarize(ym(date)),income=historic(date,'income'),expense=historic(date,'expense');
 if(!income||!expense)return {available:false,current};
 const days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate(),fraction=Math.max(0,days-date.getDate())/days;
 const projectedIncome=current.income+income.average*fraction,projectedExpense=current.expense+expense.average*fraction;
 return {available:true,current,projectedIncome,projectedExpense,projectedNet:projectedIncome-projectedExpense,months:Math.min(income.months,expense.months)};
}
function emergency(){return {reserve:state.reserve,essential:state.essential,months:state.essential>0?state.reserve/state.essential:null};}
function annual(year){
 const data=Array.from({length:12},(_,i)=>({month:year+'-'+String(i+1).padStart(2,'0'),...summarize(year+'-'+String(i+1).padStart(2,'0'))}));
 return {data,income:data.reduce((a,x)=>a+x.income,0),expense:data.reduce((a,x)=>a+x.expense,0)};
}
function alerts(date=new Date()){
 const messages=[],cash=summarize(ym(date)),e=emergency(),net=window.RICO_NET_WORTH?.totals?.();
 if(cash.count&&cash.net<0)messages.push(['red','Recorded monthly shortfall: '+php(-cash.net)]);
 if(e.months!==null&&e.months<3)messages.push(['amber','Emergency fund covers '+e.months.toFixed(1)+' months, below the 3-month benchmark.']);
 if(net&&net.assets>0&&net.liabilities/net.assets>.6)messages.push(['amber','Recorded debts exceed 60% of assets.']);
 const previous=historic(date,'expense');
 if(previous?.average>0&&cash.expense>1.3*previous.average)messages.push(['amber','Recorded spending is over 30% above the prior-month average.']);
 if(!cash.count)messages.push(['neutral','No recorded Cash Flow transactions this month.']);
 return messages.length?messages:[['green','No alerts from the available records.']];
}
function observed(){
 const result=state.snapshots.map(x=>({...x}));
 try{const days=JSON.parse(localStorage.getItem(HISTORY)||'[]');
  if(Array.isArray(days))for(const day of days){
   if(!day||typeof day.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.day)||!Number.isFinite(day.value))continue;
   const m=day.day.slice(0,7);
   if(!result.some(x=>x.month===m))result.push({month:m,assets:null,liabilities:null,netWorth:day.value});
  }
 }catch{}
 return result.sort((a,b)=>a.month.localeCompare(b.month));
}
function capture(){
 const n=window.RICO_NET_WORTH?.totals?.();
 if(!n||!['assets','liabilities','netWorth'].every(k=>Number.isFinite(n[k]))||loadError)return;
 const m=ym(new Date()),prior=state.snapshots.find(x=>x.month===m);
 if(prior&&prior.assets===n.assets&&prior.liabilities===n.liabilities&&prior.netWorth===n.netWorth)return;
 try{save({...state,snapshots:[...state.snapshots.filter(x=>x.month!==m),{month:m,assets:n.assets,liabilities:n.liabilities,netWorth:n.netWorth}].sort((a,b)=>a.month.localeCompare(b.month)).slice(-120)});}catch{}
}
function metric(label,value,note){return '<div class="fps-metric"><small>'+clean(label)+'</small><strong>'+clean(value)+'</strong><span>'+clean(note)+'</span></div>';}
function reportHTML(year){
 const r=annual(year);
 return '<div class="fps-grid">'+metric('Yearly income',php(r.income),'Actual recorded income')+metric('Yearly expenses',php(r.expense),'Net: '+php(r.income-r.expense))+'</div><div class="fps-overflow"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>'+
 r.data.map(x=>'<tr><td>'+x.month+'</td><td>'+php(x.income)+'</td><td>'+php(x.expense)+'</td><td>'+php(x.net)+'</td></tr>').join('')+'</tbody></table></div>';
}
function csv(year){
 const r=annual(year),lines=[['Month','Income PHP','Expenses PHP','Net PHP'],...r.data.map(x=>[x.month,x.income.toFixed(2),x.expense.toFixed(2),x.net.toFixed(2)]),['TOTAL',r.income.toFixed(2),r.expense.toFixed(2),(r.income-r.expense).toFixed(2)]];
 return '\uFEFF'+lines.map(x=>x.join(',')).join('\r\n');
}
function render(){
 const root=$('financialPlanningSuite');if(!root)return;
 const expanded=[...root.querySelectorAll('details[open]')].map(x=>x.id),inputIds=['fpsGoalName','fpsGoalTarget','fpsGoalSaved','fpsGoalDeadline','fpsYear'];
 const existing=Object.fromEntries(inputIds.map(id=>[id,$(id)?.value||'']));
 const e=emergency(),f=forecast(),history=observed(),year=new Date().getFullYear(),largest=Math.max(1,...history.slice(-12).map(x=>Math.abs(x.netWorth)));
 root.innerHTML='<header class="fps-head"><h2>Financial Planning & Reports</h2><span>Offline · Private</span></header>'+
 '<details id="fpsOne"><summary>1 · Emergency Fund Monitor</summary><div class="fps-body">'+
 '<div class="fps-grid">'+metric('Coverage',e.months===null?'—':e.months.toFixed(1)+' months','Target: 3–6 months')+
 metric('Six-month target',e.essential>0?php(e.essential*6):'—','Based on essential monthly expenses')+'</div>'+
 '<div class="fps-fields"><label>Emergency reserves (₱)<input id="fpsReserve" type="number" min="0" step=".01" value="'+state.reserve+'"></label><label>Essential monthly expenses (₱)<input id="fpsEssential" type="number" min="0" step=".01" value="'+state.essential+'"></label></div>'+
 '<button data-save-reserve type="button">Save emergency fund</button><p class="fps-note">Enter amounts yourself. Monitoring only; no new Cash Flow or Net Worth records.</p></div></details>'+
 '<details id="fpsTwo"><summary>2 · Financial Goals Tracker</summary><div class="fps-body">'+
 (state.goals.map(g=>'<div class="fps-goal"><div><b>'+clean(g.name)+'</b><small>'+php(g.saved)+' of '+php(g.target)+(g.deadline?' · '+clean(g.deadline):'')+'</small><progress max="100" value="'+Math.min(100,g.saved/g.target*100)+'"></progress></div><button type="button" data-delete-goal="'+clean(g.id)+'">Delete</button></div>').join('')||'<p class="fps-note">No goals saved yet.</p>')+
 '<div class="fps-fields"><label>Goal name<input id="fpsGoalName" maxlength="80" placeholder="e.g. Education"></label><label>Target (₱)<input id="fpsGoalTarget" type="number" min=".01" step=".01"></label><label>Saved (₱)<input id="fpsGoalSaved" type="number" min="0" step=".01"></label><label>Target date<input id="fpsGoalDeadline" type="date"></label></div>'+
 '<button type="button" data-add-goal>Add goal</button><p class="fps-note">Planning balances are separate from assets and transactions.</p></div></details>'+
 '<details id="fpsThree"><summary>3 · Cash Flow Forecast</summary><div class="fps-body">'+
 (f.available?'<div class="fps-grid">'+metric('Projected monthly net',php(f.projectedNet),'Income less expenses')+metric('Projected expenses',php(f.projectedExpense),'Through month end')+'</div><p class="fps-note">Scenario: current actuals plus time-prorated averages of '+f.months+' prior recorded months. Not a bill schedule or guaranteed balance.</p>':
 '<p class="fps-note">At least one prior completed month of recorded transactions is needed.</p>')+'</div></details>'+
 '<details id="fpsFour"><summary>4 · Net Worth History</summary><div class="fps-body">'+
 (history.length?'<div class="fps-bars" role="img" aria-label="Observed monthly net worth values">'+history.slice(-12).map(x=>'<div class="fps-column"><div class="fps-bar '+(x.netWorth<0?'minus':'')+'" style="height:'+Math.max(5,Math.abs(x.netWorth)/largest*100)+'%" title="'+clean(x.month)+' · '+clean(php(x.netWorth))+'"></div><small>'+x.month.slice(5)+'</small></div>').join('')+'</div><p class="fps-note">Latest: '+history.at(-1).month+' · '+php(history.at(-1).netWorth)+'. Historical values only from real observations.</p>':
 '<p class="fps-note">Monthly snapshots begin when the app first observes your Net Worth.</p>')+'</div></details>'+
 '<details id="fpsFive"><summary>5 · Smart Financial Alerts</summary><div class="fps-body">'+
 alerts().map(x=>'<p class="fps-alert '+x[0]+'">'+clean(x[1])+'</p>').join('')+
 '<p class="fps-note">On-device insights only; no push notifications or paid AI charges.</p></div></details>'+
 '<details id="fpsSix"><summary>6 · Annual Financial Report</summary><div class="fps-body"><label>Year<select id="fpsYear">'+Array.from({length:6},(_,i)=>year-i).map(y=>'<option value="'+y+'">'+y+'</option>').join('')+'</select></label><div id="fpsReportContents">'+reportHTML(year)+'</div><button type="button" data-export-report>Export CSV</button><p class="fps-note">Actual income and expenses only; excludes plans and debt balances.</p></div></details>'+
 (loadError?'<p class="fps-alert red">'+clean(loadError)+'</p>':'');
 expanded.forEach(id=>{if($(id))$(id).open=true;});
 inputIds.forEach(id=>{if($(id)&&existing[id])$(id).value=existing[id];});
}
function bind(){
 const root=$('financialPlanningSuite');if(!root)return;
 root.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  try{
   if(b.hasAttribute('data-save-reserve')){
    const reserve=$('fpsReserve').value,essential=$('fpsEssential').value;
    if(!money(reserve)||!money(essential))throw Error('Please enter valid amounts.');
    save({...state,reserve:Number(reserve),essential:Number(essential)});
   }
   if(b.hasAttribute('data-add-goal')){
    const name=$('fpsGoalName').value.trim(),target=$('fpsGoalTarget').value,saved=$('fpsGoalSaved').value,deadline=$('fpsGoalDeadline').value;
    if(!name||name.length>80||!money(target)||Number(target)<=0||!money(saved)||state.goals.length>=100)throw Error('Enter a name, valid target and saved amount.');
    const id=window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    save({...state,goals:[...state.goals,{id,name,target:Number(target),saved:Number(saved),deadline}]});
    ['fpsGoalName','fpsGoalTarget','fpsGoalSaved','fpsGoalDeadline'].forEach(x=>$(x).value='');
   }
   if(b.hasAttribute('data-delete-goal')){
    if(confirm('Delete this goal?'))save({...state,goals:state.goals.filter(g=>g.id!==b.getAttribute('data-delete-goal'))});
   }
   if(b.hasAttribute('data-export-report')){
    const year=Number($('fpsYear').value),blob=new Blob([csv(year)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='rico-finances-annual-'+year+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
   }
  }catch(e){alert(e.message||'Could not save planning data.');}
 });
 root.addEventListener('change',e=>{if(e.target.id==='fpsYear')$('fpsReportContents').innerHTML=reportHTML(Number(e.target.value));});
}
window.RICO_FINANCIAL_PLAN={summarize,forecast,emergency,annual,alerts,csv,validate,exportState:()=>JSON.parse(JSON.stringify(state)),refresh:render,takeSnapshot:capture};
const ready=()=>{render();bind();capture();};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
})();