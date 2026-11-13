/* Rico Finances AI v1.8.0: private paid Ask AI client.
   No OpenAI key, no owner token persisted on disk, no financial records sent without a click. */
(() => {
  'use strict';
  let ownerToken = ''; // deliberately RAM-only; never localStorage or sessionStorage
  let busy = false;
  const $ = id => document.getElementById(id);
  const config = () => String(window.RICO_AI_CONFIG?.workerUrl || '').trim().replace(/\/+$/, '');
  const info = message => { const el=$('askAiStatus'); if (el) el.textContent = message; };
  const status = value => { const el=$('askAiUsage'); if (el) el.textContent = value; };
  const apiURL = path => {
    const origin=config();
    if (!origin || !/^https:\/\/[-\w.]+(?::\d+)?$/.test(origin))
      throw new Error('Cloudflare AI is not configured. Enter the Worker URL in ai-config.js after deployment.');
    return origin + path;
  };
  function updateLockView() {
    $('askAiUnlockPanel').classList.toggle('hidden', !!ownerToken);
    $('askAiChatPanel').classList.toggle('hidden', !ownerToken);
  }
  window.openAskAi = () => {
    const dialog=$('askAiDialog');
    dialog.classList.remove('hidden');
    document.body.classList.add('ask-ai-open');
    updateLockView();
    info(config() ? 'Only the authorized owner can use paid AI.' : 'Setup needed: deploy the Cloudflare Worker and set its URL in ai-config.js.');
    setTimeout(() => (ownerToken ? $('askAiQuestion') : $('askAiTokenInput'))?.focus(),0);
  };
  window.closeAskAi = () => {
    $('askAiDialog').classList.add('hidden');
    document.body.classList.remove('ask-ai-open');
  };
  window.forgetAskAiAccess = () => {
    ownerToken='';
    $('askAiTokenInput').value='';
    $('askAiAnswer').textContent='Your response will appear here.';
    updateLockView();
    info('Locked. Your access token was discarded from app memory.');
  };
  async function callAPI(path, token, body) {
    const url=apiURL(path);
    const response=await fetch(url, {
      method:'POST',
      headers:{'Authorization':'Bearer '+token, ...(body ? {'Content-Type':'application/json'} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}),
      cache:'no-store',
      signal:AbortSignal.timeout(45000)
    });
    const data=await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI service unavailable (HTTP ${response.status}).`);
    return data;
  }
  window.unlockAskAi = async () => {
    if (busy) return;
    const candidate=$('askAiTokenInput').value.trim();
    if (candidate.length < 32) { info('Please paste your complete secret Owner Access Token (at least 32 characters).'); return; }
    busy=true; $('askAiUnlockButton').disabled=true;
    info('Verifying your authorization securely...');
    try {
      const data=await callAPI('/api/status',candidate);
      ownerToken=candidate;
      $('askAiTokenInput').value='';
      updateLockView();
      status(`Authorized · ${data.remaining} of ${data.limit} requests remaining today (UTC)`);
      info('Access verified. No financial records have been sent.');
      $('askAiQuestion').focus();
    } catch(err) {
      ownerToken='';
      info('Could not unlock: '+(err.message || 'network error')+'. Check that the token and Worker URL are correct.');
    } finally { busy=false; $('askAiUnlockButton').disabled=false; }
  };
  function financeContext(mode) {
    if (mode==='none') return null;
    // These two globals come from the unmodified finance engine in index.html.
    const list=(typeof transactions!=='undefined' && Array.isArray(transactions)) ? transactions : [];
    const date=(typeof selectedDate!=='undefined') ? selectedDate : new Date();
    const y=date.getFullYear(), m=date.getMonth();
    const filtered=list.filter(t => {
      const d=String(t.date||'');
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0,4))===y && Number(d.slice(5,7))===m+1;
    });
    const sum = (items,kind) => Math.round(items.filter(t=>t.type===kind).reduce((a,t)=>a+Number(t.amount||0),0)*100)/100;
    const byCategory = {};
    for (const t of filtered.filter(x=>x.type==='expense')) {
      const c=String(t.category||'Other').slice(0,55);
      byCategory[c]=Math.round(((byCategory[c]||0)+Number(t.amount||0))*100)/100;
    }
    const income=sum(filtered,'income'), expenses=sum(filtered,'expense');
    const allIncome=sum(list,'income'), allExpenses=sum(list,'expense');
    const result={selectedMonth:`${y}-${String(m+1).padStart(2,'0')}`, currency:'PHP', totalIncome:income, totalExpenses:expenses,
      monthNet:Math.round((income-expenses)*100)/100, allTimeBalance:Math.round((allIncome-allExpenses)*100)/100,
      monthTransactionCount:filtered.length, expenseByCategory:byCategory,
      recentMonthlySummary:Array.from({length:6},(_,i)=>{
        const d=new Date(y,m-i,1), key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const monthly=list.filter(t=>String(t.date||'').startsWith(key+'-'));
        return {month:key,income:sum(monthly,'income'),expenses:sum(monthly,'expense')};
      }).reverse()};
    if (mode==='details') result.selectedMonthTransactions=filtered.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,50).map(t=>({
      date:String(t.date||'').slice(0,10),type:t.type,amount:Number(t.amount),category:String(t.category||'').slice(0,60),
      description:String(t.desc||'').slice(0,120)
    }));
    return result;
  }
  window.sendAskAiQuestion = async () => {
    if (busy || !ownerToken) return;
    const message=$('askAiQuestion').value.trim();
    if (!message) { info('Please type your question.'); $('askAiQuestion').focus(); return; }
    const mode=$('askAiPrivacyMode').value;
    busy=true; $('askAiSendButton').disabled=true;
    $('askAiAnswer').textContent='Thinking...'; info('Sending your question securely. This may take some time.');
    try {
      const result=await callAPI('/api/chat',ownerToken,{message,context:financeContext(mode),privacyMode:mode});
      $('askAiAnswer').textContent=String(result.answer||'No text response.');
      status(`Authorized · ${result.remaining} of ${result.limit} requests remaining today (UTC)`);
      info('Completed. AI did not edit your financial records.');
    } catch(err) {
      $('askAiAnswer').textContent='Could not retrieve an AI answer.';
      info('Request failed: '+(err.message||'Connection error')+'. Your transactions were not changed.');
    } finally {busy=false; $('askAiSendButton').disabled=false;}
  };
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape' && !$('askAiDialog').classList.contains('hidden')) window.closeAskAi();
  });
})();
