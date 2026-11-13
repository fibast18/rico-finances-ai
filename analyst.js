/* Rico Finances v1.7.1 — fully offline, rule-based, read-only Analyst.
   No external model/API, network calls, or transaction mutations.
   Uses the existing 'transactions' and 'selectedDate' variables. */
(function () {
  'use strict';
  const money = value => formatPHP(value);
  const roundPct = value => Math.round(value * 100);
  const monthKey = date => String(date.getFullYear())+'-'+String(date.getMonth()+1).padStart(2,'0');
  const monthLabel = date => date.toLocaleDateString('en-PH',{month:'short',year:'numeric'});
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function snapshot(date) {
    const key = monthKey(date);
    const rows = (Array.isArray(transactions) ? transactions : []).filter(t => t &&
      typeof t.date === 'string' && t.date.slice(0,7) === key && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
      (t.type === 'income' || t.type === 'expense') && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0);
    const totals = {income:0,expense:0};
    const category = new Map();
    let maxExpense = null;
    for (const t of rows) {
      const amount = Number(t.amount);
      totals[t.type] += amount;
      if (t.type === 'expense') {
        const label = typeof t.category === 'string' && t.category.trim() ? t.category.trim() : 'Uncategorized';
        category.set(label,(category.get(label)||0)+amount);
        if (!maxExpense || amount>maxExpense.amount) {
          maxExpense={amount, category:label, desc:typeof t.desc==='string'?t.desc:label, date:t.date};
        }
      }
    }
    const top=[...category].sort((a,b)=>b[1]-a[1]);
    return {date, key, label:monthLabel(date), rows, income:totals.income,
      expense:totals.expense, net:totals.income-totals.expense,
      top, maxExpense, expenseCount:rows.filter(r=>r.type==='expense').length};
  }
  function previousDate(date, n=1) { return new Date(date.getFullYear(),date.getMonth()-n,1); }
  const description=(k,v,note,color='neutral') => '<div class="ai-metric"><div class="ai-metric-label">'+escape(k)+'</div><div class="ai-metric-value ai-color-'+color+'">'+escape(v)+'</div><div class="ai-metric-note">'+escape(note)+'</div></div>';
  function insight(head, body){return '<article class="ai-insight"><h4 class="ai-insight-head">'+escape(head)+'</h4><p class="ai-insight-body">'+escape(body)+'</p></article>';}
  function findings(now, prior){
    if (!now.rows.length) return [{title:'No entries for this month',body:'Add an income or expense using the blue + button. The Analyst will then calculate observations automatically.'},
      {title:'Private and read-only',body:'Analysis uses only transactions recorded on this device. It never changes your financial entries.'}];
    const notes=[];
    if (now.income>0){
      const pct=roundPct(now.expense/now.income);
      if(now.net<0) notes.push({title:'Spending exceeds recorded income',body:`Expenses are ${pct}% of recorded income, leaving a ${money(-now.net)} monthly shortfall. Review large or optional expenses.`});
      else if(pct>=90) notes.push({title:'Limited monthly surplus',body:`You recorded expenses equal to ${pct}% of income, leaving ${money(now.net)}. Consider protecting a cash buffer.`});
      else notes.push({title:'Cash flow is positive',body:`Your recorded surplus is ${money(now.net)}. Expenses used ${pct}% of logged income; the rest is not necessarily saved cash.`});
    } else if(now.expense>0) notes.push({title:'No recorded income',body:`You entered ${money(now.expense)} in expenses, but no income for this month. The app cannot estimate a savings rate without income entries.`});
    else notes.push({title:'Income logged without expenses',body:`You recorded ${money(now.income)} in income and no expenses. Make sure all spending is logged before treating this as savings.`});
    if (now.top.length){
      const [category, amount] = now.top[0];
      const share=roundPct(amount/now.expense);
      notes.push({title:'Largest spending category',body:`${category} totals ${money(amount)} (${share}% of this month's recorded expenses). A 10% reduction in this category would be ${money(amount*.1)} if feasible.`});
    }
    if (prior.rows.length && now.expense>0 && prior.expense>0){
      const delta=now.expense-prior.expense;
      if(Math.abs(delta)<.005)notes.push({title:'Expenses unchanged',body:`Expenses match ${prior.label} at ${money(now.expense)}. Both amounts reflect only what was logged.`});
      else notes.push({title:delta>0?'Higher spending than last month':'Lower spending than last month',body:`Recorded expenses are ${money(Math.abs(delta))} ${delta>0?'higher':'lower'} than ${prior.label} (${Math.abs(roundPct(delta/prior.expense))}% ${delta>0?'increase':'decrease'}). Months may have different numbers of logged days.`});
    }else if(!prior.rows.length){
      notes.push({title:'More history improves comparisons',body:'No transactions are logged for the preceding month. Add earlier records to see month-to-month changes.'});
    }
    if(now.maxExpense && now.expenseCount>1 && now.maxExpense.amount>=now.expense*.4){
      notes.push({title:'One large expense stands out',body:`${now.maxExpense.desc || now.maxExpense.category} was ${money(now.maxExpense.amount)} on ${now.maxExpense.date}, representing ${roundPct(now.maxExpense.amount/now.expense)}% of logged expenses.`});
    }
    return notes.slice(0,4);
  }
  function quickAnswer(question, now, prior) {
    if(!now.rows.length)return 'There are no recorded transactions for '+now.label+'. Use the blue + button to add an entry, then ask again.';
    switch(question){
      case 'summary':
        return `${now.label}: income ${money(now.income)}, expenses ${money(now.expense)}, and ${now.net<0?'shortfall':'net cash flow'} ${money(Math.abs(now.net))}. These are recorded monthly movements, not your total cash-on-hand balance.`;
      case 'spending':
        return now.top.length ? 'Your biggest spending categories this month are: '+now.top.slice(0,3).map(([cat,amount],i)=>`${i+1}. ${cat} — ${money(amount)} (${roundPct(amount/now.expense)}%)`).join('; ')+'.' : 'There are no expense entries for this month.';
      case 'compare':
        if(!prior.rows.length) return `No transactions are logged for ${prior.label}, so a reliable month comparison is unavailable.`;
        if(!prior.expense && !now.expense)return `No expenses were recorded in either ${prior.label} or ${now.label}.`;
        if(!prior.expense) return `You logged no expenses for ${prior.label} versus ${money(now.expense)} for ${now.label}. A percentage change is not meaningful from a zero baseline.`;
        const change=now.expense-prior.expense;
        return `Recorded expenses: ${prior.label} ${money(prior.expense)}; ${now.label} ${money(now.expense)}. ${change>0?'Increased':change<0?'Decreased':'Unchanged'} by ${money(Math.abs(change))}${Math.abs(change)<.005?'':` (${Math.abs(roundPct(change/prior.expense))}%)`}. The months may be incomplete, so compare carefully.`;
      case 'savings':
        if(!now.expense)return `No spending is recorded in ${now.label}. First log your expenses to identify possible savings.`;
        const [category,amount]=now.top[0];
        return `A practical starting point is to review ${category}, your largest expense category at ${money(amount)}. Trimming it by 5% could free up about ${money(amount*.05)}; 10% could free up ${money(amount*.1)}. These are examples, not guaranteed savings. Avoid reducing essential needs.`;
      default:return 'Select a question above to view a calculation from this month’s entries.';
    }
  }
  function trendHtml(date){
    const series=[5,4,3,2,1,0].map(offset=>snapshot(previousDate(date,offset)));
    const highest=Math.max(...series.map(s=>s.expense),1);
    return series.map(s=>'<div class="ai-history-line"><span>'+escape(s.date.toLocaleDateString('en-PH',{month:'short'}))+'</span>'+
      '<div class="ai-history-meter"><div class="ai-history-fill" style="width:'+Math.round(s.expense/highest*100)+'%"></div></div>'+
      '<span class="ai-history-value">'+escape(money(s.expense))+'</span></div>').join('');
  }
  window.renderFinanceAnalyst=function(){
    const node=document.getElementById('aiAnalystSection');if(!node)return;
    const now=snapshot(selectedDate),prior=snapshot(previousDate(selectedDate));
    document.getElementById('aiAnalystPeriod').textContent=now.label+' · '+now.rows.length+' logged transaction'+(now.rows.length===1?'':'s');
    const percent=now.income>0?roundPct(now.net/now.income)+'%':'N/A';
    const ratio=now.income>0?roundPct(now.expense/now.income)+'%':'N/A';
    const top=now.top[0];
    document.getElementById('aiAnalystOverview').innerHTML=
      description('Monthly net cash flow',money(now.net),'Income − expenses',now.net<0?'negative':now.net>0?'positive':'neutral')+
      description('Income left after expenses',percent,now.income>0?'% of recorded income':'No income recorded',now.income>0 && now.net>=0?'positive':now.income>0?'negative':'neutral')+
      description('Expense-to-income',ratio,now.income>0?'Based on logged entries':'Income not recorded',now.income>0 && now.expense>now.income?'negative':'neutral')+
      description('Top expense category',top?top[0]:'None',top?money(top[1]):'No expenses recorded','neutral');
    document.getElementById('aiAnalystHighlights').innerHTML=findings(now,prior).map(note=>insight(note.title,note.body)).join('');
    document.getElementById('aiAnalystTrend').innerHTML=trendHtml(selectedDate);
    const answer=document.getElementById('aiAnalystAnswer');
    answer.textContent='Choose a question to see an explanation based on your records.';
  };
  window.askFinanceAnalyst=function(question){
    const now=snapshot(selectedDate),prior=snapshot(previousDate(selectedDate));
    const answer=document.getElementById('aiAnalystAnswer');
    if(answer)answer.textContent=quickAnswer(question,now,prior);
  };
})();
