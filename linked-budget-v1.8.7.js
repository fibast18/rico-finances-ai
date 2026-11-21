/* Rico Finances AI v1.8.7 — separately labeled read-only family budget.
   Uses the existing Loan Tracker pairing key. Nothing is added to cash-flow
   transaction totals or net-worth assets. Offline budget snapshots are local.
*/
(() => {
 'use strict';
 const ENDPOINT='https://pono-family-loan-tracker.rjpono.workers.dev/api/networth-read';
 const TOKEN_KEY='rico_finances_ai_loan_read_code_v1';
 const CACHE_KEY='rico_finances_ai_monthly_budget_cache_v1';
 const $=id=>document.getElementById(id);
 const money=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 let cache={},current='',activeBudget=null,busy=false,requestId=0,lastFetch=new Map();
 const monthFromDisplay=()=>{
  const label=$('selectedMonthDisplay')?.textContent?.trim()||'';
  const found=/^([A-Za-z]+) (20\d{2})$/.exec(label);
  if(found){const idx=months.indexOf(found[1]);if(idx>=0)return found[2]+'-'+String(idx+1).padStart(2,'0');}
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).format(new Date());
 };
 const linked=()=>{try{return localStorage.getItem(TOKEN_KEY)||'';}catch{return '';}};
 function readCache(){
  try{
   const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
   if(saved && typeof saved==='object'&&!Array.isArray(saved))cache=saved;
  }catch{cache={};}
 }
 function storeCache(){
  try{
   const entries=Object.entries(cache).filter(([k,v])=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(k)&&v?.budget)
    .sort((a,b)=>(b[1].at||'').localeCompare(a[1].at||'')).slice(0,12);
   cache=Object.fromEntries(entries);
   localStorage.setItem(CACHE_KEY,JSON.stringify(cache));
  }catch{setStatus('Offline budget could not be saved on this device.',true);}
 }
 function clearCache(){
  cache={};activeBudget=null;try{localStorage.removeItem(CACHE_KEY);}catch{}
 }
 function setStatus(s,error=false){const n=$('linkedBudgetStatus');if(n){n.textContent=s;n.classList.toggle('lb-error',error);}}
 function fmtMonth(m){
  const match=/^(20\d{2})-(0[1-9]|1[0-2])$/.exec(m);
  return match?months[Number(match[2])-1]+' '+match[1]:m;
 }
 const safeNumber=v=>Number.isFinite(v)&&v>=-1e12&&v<=1e12;
 function normalize(response,month){
  if(!response||response.source!=='pono-family-loan-tracker'||!response.budget||response.budget.month!==month)throw Error('Invalid Loan Tracker budget response.');
  const b=response.budget;
  if(b.available===false)return {month,available:false};
  if(b.available!==true||b.planningOnly!==true||!['before-loans','after-loans'].includes(b.incomeBasis)||!Array.isArray(b.incomes)||!Array.isArray(b.expenses)||b.incomes.length>100||b.expenses.length>100||!b.totals)throw Error('Invalid budget format.');
  const itemList=rows=>rows.map(row=>{
   if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.length>100||!safeNumber(row.amount)||row.amount<0)throw Error('Invalid budget category.');
   return {name:row.name,amount:row.amount};
  });
  const tot=b.totals;
  for(const name of ['income','expenses','countedLoanDeduction','outgoings','remaining']){
   if(!safeNumber(tot[name]))throw Error('Invalid monthly budget totals.');
  }
  if(!safeNumber(b.loanDeduction)||b.loanDeduction<0)throw Error('Invalid loan deduction total.');
  return {month,available:true,saved:b.saved===true,planningOnly:true,
   incomeBasis:b.incomeBasis,incomes:itemList(b.incomes),expenses:itemList(b.expenses),
   loanDeduction:b.loanDeduction,totals:Object.fromEntries(Object.keys(tot).map(k=>[k,tot[k]]))};
 }
 function showRows(id,items){
  const holder=$(id);holder.replaceChildren();
  for(const item of items){
   const row=document.createElement('div');row.className='lb-row';
   const label=document.createElement('span');label.textContent=item.name;
   const val=document.createElement('strong');val.textContent=money(item.amount);
   row.append(label,val);holder.append(row);
  }
 }
 function render(){
  const connected=!!linked();
  $('linkedBudgetMonth').textContent=fmtMonth(current);
  $('linkedBudgetRefresh').disabled=!connected||busy;
  if(!connected){
   $('linkedBudgetContent').hidden=true;
   setStatus('Connect Loan Tracker under Net Worth to view your family budget.');
   activeBudget=null;
   return;
  }
  const saved=cache[current];
  activeBudget=saved?.budget||null;
  if(!activeBudget){
   $('linkedBudgetContent').hidden=true;
   if(!busy)setStatus('No budget snapshot for this month. Tap Refresh while online.');
   return;
  }
  if(!activeBudget.available){
   $('linkedBudgetContent').hidden=true;
   setStatus('No saved family budget has been set up in Loan Tracker yet.');
   return;
  }
  const b=activeBudget;
  $('linkedBudgetContent').hidden=false;
  $('linkedBudgetIncome').textContent=money(b.totals.income);
  $('linkedBudgetExpenses').textContent=money(b.totals.expenses);
  $('linkedBudgetDeductions').textContent=money(b.totals.countedLoanDeduction);
  $('linkedBudgetRemaining').textContent=money(b.totals.remaining);
  $('linkedBudgetRemaining').classList.toggle('lb-negative',b.totals.remaining<0);
  $('linkedBudgetBasis').textContent=(b.saved?'Saved monthly budget':'Recurring budget defaults (not separately saved for this month)')+
   (b.incomeBasis==='before-loans'?' · Income before loan deductions':' · Take-home income; loan deductions already excluded')+
   (b.incomeBasis==='after-loans'?' · Scheduled loan payments: '+money(b.loanDeduction)+' (not subtracted again)':'');
  showRows('linkedBudgetIncomeRows',b.incomes);
  showRows('linkedBudgetExpenseRows',b.expenses);
  if(!busy){
   const last=cache[current]?.at;
   setStatus('Read-only plan · '+(last?'Last refreshed '+new Date(last).toLocaleString('en-PH',{dateStyle:'short',timeStyle:'short'}):'Cached')+
    (!navigator.onLine?' · Offline snapshot':''));
  }
 }
 async function refresh(force=false){
  const m=monthFromDisplay();
  if(current!==m){current=m;render();}
  const token=linked();
  if(!token){clearCache();render();return;}
  if(!navigator.onLine){
   render();if(!activeBudget)setStatus('Offline: no saved budget for this month.');
   return;
  }
  if(busy)return;
  const last=lastFetch.get(m)||0;
  if(!force && Date.now()-last<5*60000){render();return;}
  lastFetch.set(m,Date.now());busy=true;
  const sequence=++requestId;
  setStatus('Refreshing family budget from Loan Tracker…');
  $('linkedBudgetRefresh').disabled=true;
  try{
   const url=ENDPOINT+'?month='+encodeURIComponent(m);
   const response=await fetch(url,{method:'GET',mode:'cors',cache:'no-store',
    credentials:'omit',redirect:'error',headers:{Authorization:'Bearer '+token}});
   if(!response.ok){
    let err='HTTP '+response.status;
    try{err=(await response.json()).error||err;}catch{}
    throw Error(err);
   }
   const b=normalize(await response.json(),m);
   if(sequence===requestId && token===linked()){
    cache[m]={budget:b,at:new Date().toISOString()};
    storeCache();
   }
  }catch(error){
   if(sequence===requestId)setStatus('Refresh failed: '+(error?.message||'Network unavailable')+'. Previously saved budgets remain unchanged.',true);
  }finally{
   busy=false;
   render();
  }
 }
 function onMonthChange(){
  const m=monthFromDisplay();
  if(m!==current){current=m;render();refresh();}
 }
 function aiSummary(){
  if(!activeBudget?.available||!linked())return '';
  const b=activeBudget;
  return 'LINKED MONTHLY HOUSEHOLD BUDGET '+b.month+
   ' (PLAN, NOT ACTUAL TRANSACTIONS): income='+b.totals.income+
   ', ordinary expenses='+b.totals.expenses+
   ', counted payroll loan deduction='+b.totals.countedLoanDeduction+
   ', estimated remainder='+b.totals.remaining+
   ', basis='+b.incomeBasis+(b.saved?', saved month':', recurring default')+'.';
 }
 function disconnect(){clearCache();render();}
 function init(){
  readCache();current=monthFromDisplay();render();
  $('linkedBudgetRefresh').addEventListener('click',()=>refresh(true));
  const display=$('selectedMonthDisplay');
  if(display && typeof MutationObserver!=='undefined'){
   new MutationObserver(onMonthChange).observe(display,{childList:true,characterData:true,subtree:true});
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('online',()=>refresh(true));
  window.addEventListener('pageshow',()=>refresh());
  refresh(true);
 }
 window.RICO_LINKED_BUDGET={version:'1.8.7',refresh,render,disconnect,aiSummary};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
})();
