/* v1.8.17: Read-only Financial Health Dashboard. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const php=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
const pct=n=>(n*100).toFixed(1)+'%';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
// Simple visual guidelines, not personalized financial advice.
const tone=(id,value)=>{const el=$(id)?.closest('.fh-card');if(!el)return;el.classList.remove('fh-green','fh-amber','fh-red','fh-neutral');el.classList.add('fh-'+value);};
function render(){
 if(!$('financialHealthDashboard'))return;
 const now=new Date(),month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 let income=0,expense=0,entries=0;
 for(const t of window.RICO_GET_ALL_CASH_FLOW?.()||[]){
  if(!t||typeof t.date!=='string'||t.date.slice(0,7)!==month||!/^\d{4}-\d{2}-\d{2}$/.test(t.date))continue;
  const amount=Number(t.amount);if(!Number.isFinite(amount)||amount<=0)continue;
  if(t.type==='income'){income+=amount;entries++;}else if(t.type==='expense'){expense+=amount;entries++;}
 }
 const nw=window.RICO_NET_WORTH?.totals?.(),cash=income-expense;
 let trend='Baseline begins today. No earlier snapshot yet.',change=null;
 if(nw&&Number.isFinite(nw.netWorth)){
  try{
   const id='rico-fin-health-history-v1',raw=JSON.parse(localStorage.getItem(id)||'[]');
   const history=Array.isArray(raw)?raw.filter(x=>x&&typeof x.day==='string'&&Number.isFinite(x.value)).slice(-365):[];
   const prior=history.find(x=>x.day!==today());
   if(history.at(-1)?.day===today())history[history.length-1].value=nw.netWorth;
   else history.push({day:today(),value:nw.netWorth});
   localStorage.setItem(id,JSON.stringify(history.slice(-365)));
   if(prior){const delta=nw.netWorth-prior.value;change=delta;trend=(delta>=0?'+':'')+php(delta)+' since '+prior.day;}
  }catch{}
 }
 const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
 set('fhPeriod',now.toLocaleDateString('en-PH',{month:'long',year:'numeric'}));
 set('fhSavings',income>0?pct(cash/income):'—');
 set('fhSavingsNote',income>0?'Monthly surplus / recorded income':'No income recorded this month');
 set('fhRatio',nw&&nw.assets>0?pct(nw.liabilities/nw.assets):'—');
 set('fhRatioNote',nw?'Debts '+php(nw.liabilities)+' · Assets '+php(nw.assets):'Net Worth not available');
 set('fhWorth',nw?php(nw.netWorth):'—');set('fhWorthNote',nw?trend:'Net Worth not available');
 set('fhCash',entries?php(cash):'—');
 set('fhCashNote',entries?'Income '+php(income)+' · Expenses '+php(expense):'No recorded activity this month');
 set('fhStatus',entries?(cash>0?'Surplus':cash<0?'Shortfall':'Balanced'):'No data');
 tone('fhSavings',income<=0?'neutral':cash/income>=.2?'green':cash>=0?'amber':'red');
 tone('fhRatio',!nw||nw.assets<=0?'neutral':nw.liabilities/nw.assets<.3?'green':nw.liabilities/nw.assets<=.6?'amber':'red');
 tone('fhWorth',!nw?'neutral':nw.netWorth<0?'red':nw.netWorth===0?'amber':change!==null&&change<0?'amber':'green');
 tone('fhCash',!entries?'neutral':cash>0?'green':cash===0?'amber':'red');
}
window.renderFinancialHealth=render;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
})();