/* Rico Finances AI v1.8.15 — integrated, entirely on-device financial Analyst.
   Reads saved Cash Flow + included paid utilities, selected Loan Tracker debt,
   household budget plan, and Net Worth. It never changes records or sends requests.
*/
(function () {
 'use strict';
 const $=id=>document.getElementById(id);
 const money=value=>typeof formatPHP==='function'?formatPHP(value):
   new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value);
 const pct=value=>Math.round(value*100)+'%';
 const key=date=>String(date.getFullYear())+'-'+String(date.getMonth()+1).padStart(2,'0');
 const label=date=>date.toLocaleDateString('en-PH',{month:'short',year:'numeric'});
 const previous=(date,n=1)=>new Date(date.getFullYear(),date.getMonth()-n,1);
 const escape=value=>String(value).replace(/[&<>"']/g,c=>
   ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const nice=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
 function allRows(){
   try {
     const entries=typeof window.RICO_GET_ALL_CASH_FLOW==='function'?
       window.RICO_GET_ALL_CASH_FLOW():
       (typeof transactions!=='undefined'&&Array.isArray(transactions)?transactions:[]);
     return Array.isArray(entries)?entries:[];
   }catch{return [];}
 }
 function snapshot(date){
   const month=key(date),rows=allRows().filter(t=>t&&
     typeof t.date==='string'&&t.date.slice(0,7)===month&&
     /^\d{4}-\d{2}-\d{2}$/.test(t.date)&&
     ['income','expense'].includes(t.type)&&Number.isFinite(Number(t.amount))&&Number(t.amount)>0);
   const categories=new Map(),utilityTypes=new Map();
   let income=0,expense=0,utilityPaid=0,utilityCount=0,maxExpense=null;
   for(const t of rows){
     const amount=Number(t.amount);
     if(t.type==='income'){income+=amount;continue;}
     expense+=amount;
     const cat=typeof t.category==='string'&&t.category.trim()?t.category.trim():'Uncategorized';
     categories.set(cat,(categories.get(cat)||0)+amount);
     if(!maxExpense||maxExpense.amount<amount)maxExpense={
       amount,category:cat,desc:typeof t.desc==='string'?t.desc:cat,date:t.date
     };
     if(t.linkedUtility===true){
       utilityPaid+=amount;utilityCount++;
       const name=String(t.desc||'Paid utility').replace(/\s*·\s*Home Utilities$/i,'');
       utilityTypes.set(name,(utilityTypes.get(name)||0)+amount);
     }
   }
   return {
     key:month,date,label:label(date),rows,
     income:nice(income),expense:nice(expense),net:nice(income-expense),
     top:[...categories].sort((a,b)=>b[1]-a[1]),
     maxExpense,expenseCount:rows.filter(x=>x.type==='expense').length,
     utilityPaid:nice(utilityPaid),utilityCount,
     utilityTypes:[...utilityTypes].sort((a,b)=>b[1]-a[1])
   };
 }
 const metric=(name,value,note,color='neutral')=>
  '<div class="ai-metric"><div class="ai-metric-label">'+escape(name)+
  '</div><div class="ai-metric-value ai-color-'+color+'">'+escape(value)+
  '</div><div class="ai-metric-note">'+escape(note)+'</div></div>';
 const insight=(head,body)=>
  '<article class="ai-insight"><h4 class="ai-insight-head">'+escape(head)+
  '</h4><p class="ai-insight-body">'+escape(body)+'</p></article>';
 const renderLines=items=>items.map(([name,value])=>
   '<div class="ai-source-row"><span>'+escape(name)+'</span><strong>'+
   escape(value)+'</strong></div>').join('');
 function integrated(date){
   const month=key(date);
   const rawWorth=window.RICO_NET_WORTH?.totals?.();
   const worth=rawWorth&&Number.isFinite(rawWorth.netWorth)&&
     Number.isFinite(rawWorth.assets)&&Number.isFinite(rawWorth.liabilities)?rawWorth:null;
   const manual=window.RICO_NET_WORTH?.manualItems?.()||[];
   const linked=window.RICO_LINKED_LOANS;
   const snap=linked?.snapshot||null;
   const selected=new Set(Array.isArray(snap?.selected)?snap.selected:[]);
   const availableLoans=Array.isArray(snap?.loans)?snap.loans.filter(row=>
     Number.isFinite(row.balance)&&row.balance>0):[];
   const loans=availableLoans.filter(row=>selected.has(row.id));
   const otherLoans=availableLoans.filter(row=>!selected.has(row.id));
   const availableLoanTotal=nice(availableLoans.reduce((sum,row)=>sum+row.balance,0));
   const loanTotal=worth?Number(worth.linkedDebt)||0:
     nice(loans.reduce((sum,row)=>sum+row.balance,0));
   const loanStale=!!snap?.fetchedAt&&
     (!Number.isFinite(Date.parse(snap.fetchedAt))||
       Date.now()-Date.parse(snap.fetchedAt)>24*60*60*1000);
   const budget=window.RICO_LINKED_BUDGET?.analysisBudget?.(month)||null;
   const utilityLink=window.RICO_UTILITY_LINK;
   const utilityConnected=utilityLink?.connected===true;
   const utilityRows=Array.isArray(utilityLink?.linkedRows)?utilityLink.linkedRows:[];
   const utilityMonth=utilityRows.filter(row=>row?.date?.slice(0,7)===month);
   // Only the merged Cash Flow source establishes which paid utilities count as expenses.
   const includedUtilityIds=new Set(allRows().filter(row=>row?.linkedUtility===true).map(row=>row.id));
   const utilityExcluded=utilityMonth.filter(row=>!includedUtilityIds.has(row.id));
   return {worth,manual,loans,otherLoans,availableLoans,availableLoanTotal,
     loanTotal,loanStale,loanAsOf:snap?.asOf||'',loanAvailable:!!snap,budget,
     utilityConnected,utilityRows,utilityMonth,utilityExcluded,includedUtilityIds,
     utilitySnapshot:utilityRows.length>0,
     worthSource:worth?'Calculated from current local data and selected linked loans':'Net Worth not available'};
 }
 function lastSix(date) {
   const series=[5,4,3,2,1,0].map(offset=>snapshot(previous(date,offset)));
   const actual=series.filter(s=>s.rows.length);
   const total=actual.reduce((s,row)=>s+row.expense,0);
   const income=actual.reduce((s,row)=>s+row.income,0);
   return {series,observed:actual.length,average:actual.length?nice(total/actual.length):0,
     expense:nice(total),income:nice(income)};
 }
 function findings(now,prior,info){
   const notes=[];
   if(now.rows.length){
     if(now.income>0){
       const ratio=now.expense/now.income;
       if(now.net<0)notes.push(['Monthly shortfall',
         'Recorded expenses exceed income by '+money(-now.net)+
         ' ('+pct(ratio)+' of income). Check unusual spending and missing income.']);
       else if(ratio>=.9)notes.push(['Limited monthly surplus',
         'Expenses used '+pct(ratio)+' of recorded income; '+money(now.net)+
         ' remains before unrecorded spending.']);
       else notes.push(['Positive monthly cash flow',
         'Recorded surplus is '+money(now.net)+'; this is a monthly movement, not necessarily cash saved.']);
     }else if(now.expense>0)notes.push(['Income not recorded',
       'You logged '+money(now.expense)+' in expenses but no income for this month.']);
     if(now.top.length){
       const [cat,amount]=now.top[0];
       notes.push(['Largest spending category',
         cat+' accounts for '+money(amount)+' ('+pct(amount/now.expense)+') of recorded expenses.']);
     }
     if(prior.rows.length&&prior.expense>0&&now.expense>0)notes.push([
       now.expense>=prior.expense?'Higher expenses than last month':'Lower expenses than last month',
       'Change: '+money(Math.abs(now.expense-prior.expense))+
       ' ('+pct(Math.abs((now.expense-prior.expense)/prior.expense))+'). Months may be incomplete.'
     ]);
   }else notes.push(['No actual entries this month',
     'Add Cash Flow transactions or synchronize paid Home Utilities to review monthly movements.']);
   if(info.worth){
     if(info.worth.netWorth<0)notes.push(['Negative Net Worth',
       'Recorded debts exceed assets by '+money(-info.worth.netWorth)+
       '. Review debt balances and asset valuations.']);
     else if(info.worth.liabilities>0&&info.worth.assets>0)
       notes.push(['Debt compared with assets',
         'Recorded liabilities are '+pct(info.worth.liabilities/info.worth.assets)+
         ' of recorded asset values. This ratio is not a monthly payment obligation.']);
   }
   if(info.budget){
     const plan=info.budget;
     const estimate=Number(plan.totals?.remaining)||0;
     notes.push(['Household budget plan',
       'Loan Tracker projects '+money(estimate)+' remaining after planned costs'+
       (plan.saved?' (saved month).':' (recurring defaults).')+
       ' This is a household plan, not actual Cash Flow.']);
   }
   if(now.utilityCount>0){
     notes.push(['Paid Home Utilities included',
       now.utilityCount+' synced paid expense'+(now.utilityCount===1?'':'s')+' total '+
       money(now.utilityPaid)+' in this month’s recorded spending; they are not added again.']);
   }
   if(info.loans.length>0){
     notes.push(['Linked loans in Net Worth',
       info.loans.length+' selected Loan Tracker loan'+(info.loans.length===1?'':'s')+
       ' total '+money(info.loanTotal)+' in estimated outstanding balances.'+
       (info.loanStale?' Last cached balances may be outdated.':'')]);
   }else if(info.availableLoans.length){
     notes.push(['Loan records found but not selected',
       info.availableLoans.length+' outstanding linked loans were received, but none are selected for Net Worth. Check their boxes in the Net Worth screen.']);
   }
   if(!now.utilityCount&&info.utilityRows.length){
     notes.push(['Paid utility records found',
       info.utilityRows.length+' linked paid records exist, but none are included in '+now.label+' Cash Flow. Check the bill dates and inclusion settings.']);
   }
   return notes.slice(0,8);
 }
 function analysisSections(now,info){
   const output=[];
   if(info.worth){
     const w=info.worth, assets=info.manual.filter(x=>x.type==='asset')
       .sort((a,b)=>b.amount-a.amount).slice(0,4);
     output.push('<h4 class="ai-mini-head">Net Worth composition</h4>');
     output.push(renderLines([
       ['Recorded assets',money(w.assets)],['Outstanding debts',money(w.liabilities)],
       ['Cash Flow balance in assets/deficit',money(w.cashBalance)],
       ['Manual debt duplicates excluded',money(w.skippedDuplicates||0)],
       ...assets.map(x=>[x.name,money(x.amount)])
     ]));
     output.push('<p class="ai-analyst-smallnote">Net Worth is a current snapshot, not a monthly profit/loss. Asset values may be estimates.</p>');
   }else output.push('<p class="ai-analyst-smallnote">Net Worth records are not yet available on this device.</p>');
   if(info.budget){
     const b=info.budget,tot=b.totals||{};
     output.push('<h4 class="ai-mini-head">Household budget · '+escape(now.label)+'</h4>');
     output.push(renderLines([
       ['Planned income',money(tot.income||0)],
       ['Planned ordinary expenses',money(tot.expenses||0)],
       ['Payroll loan deductions counted',money(tot.countedLoanDeduction||0)],
       ['Planned remaining',money(tot.remaining||0)],
       ['Actual recorded expenses (separate data)',money(now.expense)]
     ]));
     output.push('<p class="ai-analyst-smallnote">Planned family figures and personal recorded spending may cover different activity. Actual loan deductions are not inserted into Cash Flow automatically.</p>');
   }else output.push('<p class="ai-analyst-smallnote">No linked household budget for '+escape(now.label)+'. Connect Loan Tracker and save a monthly budget to compare planning figures.</p>');
   if(info.loanAvailable){
     output.push('<h4 class="ai-mini-head">Loan Tracker · linked outstanding loans</h4>');
     if(info.loans.length)output.push(renderLines(info.loans.slice(0,12).map(x=>[x.name+' · included in Net Worth',money(x.balance)])));
     if(info.otherLoans.length)output.push(renderLines(info.otherLoans.slice(0,12).map(x=>[x.name+' · not selected',money(x.balance)])));
     if(!info.availableLoans.length)output.push('<p class="ai-analyst-smallnote">The linked snapshot contains no outstanding loans. Payroll deductions shown in the family budget are separate estimates.</p>');
     else output.push('<p class="ai-analyst-smallnote">'+info.availableLoans.length+' outstanding linked loans found; '+info.loans.length+
       ' selected for Net Worth. Unselected loans are visible here for reference only and are not counted in liabilities.</p>');
     if(info.loanAsOf)output.push('<p class="ai-analyst-smallnote">Balances as of '+escape(info.loanAsOf)+
       (info.loanStale?' · Cached figures may be stale.':' · Scheduled-deduction estimates.')+'</p>');
   }else output.push('<p class="ai-analyst-smallnote">No authorized Loan Tracker snapshot is available on this device.</p>');
   output.push('<h4 class="ai-mini-head">Linked Home Utilities · '+escape(now.label)+'</h4>');
   if(now.utilityCount)output.push('<p class="ai-analyst-smallnote">'+now.utilityCount+
     ' linked paid entries already included in monthly expenses; do not add them again.</p>');
   if(info.utilityMonth.length){
     output.push(renderLines(info.utilityMonth.slice(-15).map(row=>[
       String(row.desc||'Paid utility').replace(/\s*·\s*Home Utilities$/i,'')+
         ' · '+row.date+' · '+(info.includedUtilityIds.has(row.id)?'included':'not included'),
       money(row.amount)
     ])));
     if(info.utilityExcluded.length)output.push('<p class="ai-analyst-smallnote">'+info.utilityExcluded.length+
       ' paid records dated this month are not included in Cash Flow. Review their inclusion boxes in Paid Home Utilities.</p>');
   }else if(info.utilityRows.length){
     const dates=info.utilityRows.map(x=>x.date).filter(Boolean).sort();
     output.push('<p class="ai-analyst-smallnote">'+info.utilityRows.length+
       ' paid records exist in the linked Home Utilities snapshot, but none are dated '+escape(now.label)+
       '. Latest bill/record date: '+escape(dates.at(-1)||'unknown')+'. Select another month to see them.</p>');
   }else output.push('<p class="ai-analyst-smallnote">No paid records are available in the Home Utilities snapshot. Check published paid statuses and authorization'+
     (info.utilityConnected?'':' on this Finances device')+'.</p>');
   output.push('<p class="ai-analyst-smallnote">Dates follow utility bill/record dates, not necessarily payment dates. Excluded linked records are never added to actual spending.</p>');
   return output.join('');
 }
 function quickAnswer(question,now,prior,info,history){
   switch(question){
     case 'summary':
       return now.label+': recorded income '+money(now.income)+', spending '+money(now.expense)+
         ', monthly net '+money(now.net)+'.'+
         (info.worth?' Current Net Worth '+money(info.worth.netWorth)+'.':'')+
         ' Monthly movements are distinct from total assets and debts.';
     case 'spending':
       return now.top.length?'Top actual expense categories: '+
         now.top.slice(0,4).map(([cat,amount],i)=>(i+1)+'. '+cat+' '+money(amount)).join('; ')+
         '. Includes synchronized paid utilities without double-counting matching manual payments.':
         'There are no actual expenses in the selected month.';
     case 'compare':
       if(!prior.rows.length)return 'No recorded entries for '+prior.label+'. A reliable comparison is not available.';
       return 'Actual expenses: '+prior.label+' '+money(prior.expense)+' versus '+
         now.label+' '+money(now.expense)+'. Difference '+money(now.expense-prior.expense)+
         '. Recorded months can be incomplete.';
     case 'savings':
       if(!now.top.length)return 'Log current expenses to identify concrete savings opportunities.';
       const [cat,value]=now.top[0];
       return 'Review '+cat+' ('+money(value)+'). A 5% reduction would be '+money(value*.05)+
         ' if feasible. Keep essential expenses and loan obligations in view.';
     case 'networth':
       if(!info.worth)return 'No Net Worth data is available yet. Add assets or debts in Net Worth.';
       return 'Current recorded assets '+money(info.worth.assets)+', debts '+
         money(info.worth.liabilities)+', estimated Net Worth '+money(info.worth.netWorth)+
         '. This includes the automatic Cash Flow cash balance and eligible selected linked loans; matching debt entries are excluded.';
     case 'loans':
       if(!info.loanAvailable)return 'Loan Tracker is not paired or no saved loan snapshot is available on this device. Check the connection in Net Worth.';
       if(!info.availableLoans.length)return 'Loan Tracker is linked but its latest snapshot contains no outstanding loans. Planned payroll deductions in the family budget are not the same as outstanding loan balances.';
       if(info.loans.length)return 'Selected estimated outstanding loans total '+money(info.loanTotal)+' across '+
         info.loans.length+' loans: '+info.loans.slice(0,5).map(x=>x.name+' '+money(x.balance)).join('; ')+
         (info.otherLoans.length?'. '+info.otherLoans.length+' other linked loans totaling '+money(info.availableLoanTotal-info.loanTotal)+' are not selected or counted in Net Worth.':'')+
         ' Scheduled deductions are not automatically Cash Flow expenses.';
       return 'Loan Tracker provides '+info.availableLoans.length+' outstanding linked loans totaling '+
         money(info.availableLoanTotal)+', but none are currently selected for Net Worth. Available: '+
         info.availableLoans.slice(0,5).map(x=>x.name+' '+money(x.balance)).join('; ')+
         '. Select the loans you want counted under Net Worth. Unselected balances remain reference-only.';
     case 'budget':
       if(!info.budget)return 'No linked household budget is saved for '+now.label+
         '. Connect Loan Tracker and sync the selected month.';
       return 'Planned household income '+money(info.budget.totals.income)+
         ', planned ordinary expenses '+money(info.budget.totals.expenses)+
         ', payroll loan deductions counted '+money(info.budget.totals.countedLoanDeduction)+
         ', planned remainder '+money(info.budget.totals.remaining)+
         '. Actual expenses recorded here are '+money(now.expense)+
         '. These are different scopes; do not subtract loan deductions twice.';
     case 'utilities':
       if(now.utilityCount)return now.utilityCount+' linked paid Home Utilities entries totaling '+money(now.utilityPaid)+
         ' appear in '+now.label+' actual expenses: '+now.utilityTypes.map(([name,amount])=>
           name+' '+money(amount)).join('; ')+'.'+
           (info.utilityExcluded.length?' Another '+info.utilityExcluded.length+' linked entries for this month are excluded.':'')+
           ' Bill/record dates may differ from payment dates, and expenses are counted only once.';
       if(info.utilityMonth.length)return info.utilityMonth.length+' paid Home Utilities records totaling '+
         money(info.utilityMonth.reduce((n,x)=>n+x.amount,0))+' are linked for '+now.label+
         ', but none are included in Cash Flow. Review their inclusion checkboxes. Excluded records do not affect expenses.';
       if(info.utilityRows.length){
         const latest=info.utilityRows.map(x=>x.date).sort().at(-1);
         return 'Home Utilities has '+info.utilityRows.length+' linked paid entries, but none is dated '+now.label+
           '. Latest bill/record date: '+latest+'. Select another month or check record dates. These records are not counted in this month’s expenses.';
       }
       return info.utilityConnected?'Home Utilities is connected, but its linked paid snapshot currently has no records. Verify that paid entries were published in Home Utilities.':
         'No synced paid Home Utilities records are available. Check authorization, sync status and paid records in the source Home Utilities app.';
     case 'trend':
       return history.observed?
         'Across '+history.observed+' months with recorded transactions in the six-month window, '+
         'total spending is '+money(history.expense)+' and average recorded monthly spending is '+
         money(history.average)+'. This average excludes months with no recorded entries.':
         'No transactions are recorded in the six-month window.';
     default:return 'Choose a question for a calculation based on your available records.';
   }
 }
 function trendHtml(history){
   const max=Math.max(1,...history.series.map(s=>s.expense));
   return history.series.map(s=>
     '<div class="ai-history-line"><span>'+escape(s.date.toLocaleDateString('en-PH',{month:'short'}))+
     '</span><div class="ai-history-meter"><div class="ai-history-fill" style="width:'+
     Math.round(s.expense/max*100)+'%"></div></div><span class="ai-history-value">'+
     escape(money(s.expense))+'</span></div>').join('');
 }
 let lastQuestion='';
 function highlightQuestion(){
   const buttons=document.querySelectorAll?.('#aiAnalystSection .ai-question-grid button')||[];
   for(const button of buttons){
     const active=!!lastQuestion&&button.dataset?.analystQuestion===lastQuestion;
     button.classList?.toggle?.('ai-question-selected',active);
     button.setAttribute?.('aria-pressed',String(active));
   }
 }
 function render(){
   const main=$('aiAnalystSection');if(!main)return;
   const date=typeof selectedDate!=='undefined'?selectedDate:new Date();
   const now=snapshot(date),prior=snapshot(previous(date)),info=integrated(date),history=lastSix(date);
   const period=$('aiAnalystPeriod');
   if(period)period.textContent=now.label+' · '+now.rows.length+' recorded income/expense entries'+
     (now.utilityCount?' · '+now.utilityCount+' paid utilities':'');
   const ratio=now.income>0?pct(now.expense/now.income):'N/A';
   const remaining=now.income>0?pct(now.net/now.income):'N/A';
   $('aiAnalystOverview').innerHTML=
     metric('Monthly net cash flow',money(now.net),'Recorded income minus actual expenses',
       now.net<0?'negative':now.net>0?'positive':'neutral')+
     metric('Income left after expenses',remaining,now.income>0?'Of recorded income':'No income recorded',
       now.income>0&&now.net>=0?'positive':now.income>0?'negative':'neutral')+
     metric('Expense-to-income',ratio,now.income>0?'Actual logged entries':'Income not recorded',
       now.income>0&&now.expense>now.income?'negative':'neutral')+
     metric('Largest expense category',now.top[0]?.[0]||'None',
       now.top[0]?money(now.top[0][1]):'No recorded expenses');
   const worth=info.worth;
   $('aiAnalystIntegrated').innerHTML=
     metric('Estimated Net Worth',worth?money(worth.netWorth):'N/A',
       'Assets minus debts, current snapshot',
       worth?(worth.netWorth<0?'negative':'positive'):'neutral')+
     metric('Assets',worth?money(worth.assets):'N/A','Includes calculated cash balance')+
     metric('Liabilities',worth?money(worth.liabilities):'N/A','Manual + selected linked debt')+
     metric('Linked outstanding loans',info.loanAvailable?
       (info.loans.length?money(info.loanTotal):info.availableLoans.length?money(info.availableLoanTotal):'No outstanding loans'):'Not linked',
       info.loanAvailable?
         (info.loans.length?'Selected for Net Worth · '+info.otherLoans.length+' not selected':
           info.availableLoans.length?'Available but NOT selected for Net Worth':'No outstanding loans in snapshot'):'No loan snapshot');
   const b=info.budget;
   $('aiAnalystConnected').innerHTML=
     metric('Household budget remaining',b?money(b.totals.remaining):'Not linked',
       b?(b.saved?'Saved monthly plan':'Recurring default plan'):'No plan for selected month',
       b?(b.totals.remaining<0?'negative':'neutral'):'neutral')+
     metric('Paid Home Utilities',money(now.utilityPaid),
       now.utilityCount+' included in '+now.label+' · '+info.utilityRows.length+' linked paid records'+
         (info.utilityConnected?' · live':' · cached or not paired'));
   $('aiAnalystHighlights').innerHTML=findings(now,prior,info)
     .map(([head,body])=>insight(head,body)).join('');
   $('aiAnalystTrend').innerHTML=trendHtml(history);
   $('aiAnalystBreakdown').innerHTML=analysisSections(now,info);
   highlightQuestion();
   const answer=$('aiAnalystAnswer');
   if(answer)answer.textContent=lastQuestion?
     quickAnswer(lastQuestion,now,prior,info,history):
     'Choose a question to explore the records available for this month.';
 }
 window.renderFinanceAnalyst=render;
 window.RICO_ANALYST_REFRESH=()=>{
   const dialog=$('aiAnalystDialog');
   if(dialog&&!dialog.classList.contains('hidden'))render();
 };
 window.askFinanceAnalyst=question=>{
   lastQuestion=question;
   highlightQuestion();
   const date=typeof selectedDate!=='undefined'?selectedDate:new Date();
   const now=snapshot(date),prior=snapshot(previous(date));
   const answer=$('aiAnalystAnswer');
   if(answer)answer.textContent=quickAnswer(question,now,prior,integrated(date),lastSix(date));
 };
 window.RICO_ANALYST_TEST={snapshot,integrated,lastSix,findings,quickAnswer,highlightQuestion};
})();
