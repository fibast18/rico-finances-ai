/* Rico Finances AI v1.8.1 — existing Ask Rico paid Worker client.
   /api/session: X-Ask-Rico-Code -> {token, expiresAt}
   /api/chat: X-Ask-Rico-Session, JSON {messages:[{role,content}]} -> {reply}
   No OpenAI key/access code in GitHub. Finance data shared only by user choice.
*/
(() => {
  'use strict';
  const STORAGE_KEY = 'rico-finances-ai-ask-rico-session-v1';
  const $ = id => document.getElementById(id);
  const info = text => { const el=$('askAiStatus'); if(el) el.textContent=String(text); };
  const usage = text => { const el=$('askAiUsage'); if(el) el.textContent=String(text); };
  const urlBase = () => String(window.RICO_AI_CONFIG?.workerUrl || '').trim().replace(/\/+$/, '');
  let token = '', expiresAt = 0, busy = false, history = [];
  let priorFocus = null;
  function endpoint(path) {
    const base = urlBase();
    if(!/^https:\/\/[-\w.]+(?::\d+)?$/.test(base)) throw Error('Invalid or missing Cloudflare Worker URL in ai-config.js.');
    return base + path;
  }
  function validSession() { return !!token && expiresAt > Date.now()+20000; }
  function restoreSession() {
    if(validSession()) return;
    token=''; expiresAt=0;
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(saved && typeof saved.token==='string' && Number(saved.expiresAt)>Date.now()+20000) {
        token=saved.token; expiresAt=Number(saved.expiresAt);
        $('askAiRememberDevice').checked=true;
      } else localStorage.removeItem(STORAGE_KEY);
    } catch(_) { try { localStorage.removeItem(STORAGE_KEY); } catch(_) {} }
  }
  function discardSession() {
    token=''; expiresAt=0; history=[];
    try { localStorage.removeItem(STORAGE_KEY); } catch(_) {}
  }
  function renderView() {
    $('askAiUnlockPanel').classList.toggle('hidden',validSession());
    $('askAiChatPanel').classList.toggle('hidden',!validSession());
  }
  async function request(path, options={}) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),40000);
    try {
      const response=await fetch(endpoint(path),{
        method:'POST', mode:'cors', cache:'no-store', signal:controller.signal, ...options
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw Error(String(data.error||data.message||`Worker HTTP ${response.status}`).slice(0,300));
      return data;
    } catch(error) {
      if(error.name==='AbortError') throw Error('Request timed out. Check the internet connection.');
      if(error instanceof TypeError) throw Error('Cannot reach the shared Ask Rico Worker. Check the connection and ensure the Worker allows this GitHub Pages origin.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.openAskAi=()=>{
    priorFocus=document.activeElement;
    restoreSession();
    $('askAiDialog').classList.remove('hidden');
    document.body.classList.add('ask-ai-open');
    renderView();
    if(validSession()) {
      usage('Connected · existing Ask Rico Worker');
      info('Paid Ask AI is ready. It will not send your finance records unless you choose to share them and press Ask OpenAI.');
    } else {
      info('Enter your existing Ask Rico access code. Internet is required for initial authorization.');
    }
    setTimeout(()=>{(validSession()?$('askAiQuestion'):$('askAiTokenInput'))?.focus({preventScroll:true});},0);
  };
  window.closeAskAi=()=>{
    $('askAiDialog').classList.add('hidden');
    document.body.classList.remove('ask-ai-open');
    if(priorFocus?.focus) priorFocus.focus({preventScroll:true});
  };
  window.forgetAskAiAccess=()=>{
    discardSession();
    $('askAiTokenInput').value='';
    $('askAiRememberDevice').checked=false;
    $('askAiAnswer').textContent='Your response will appear here.';
    renderView();
    info('Disconnected. The temporary session token was cleared from this app.');
  };
  window.unlockAskAi=async()=>{
    if(busy)return;
    const code=$('askAiTokenInput').value.trim();
    if(!code){info('Enter your existing Ask Rico access code (not the OpenAI API key).');return;}
    if(!navigator.onLine){info('You must be online to authorize Ask Rico.');return;}
    busy=true; $('askAiUnlockButton').disabled=true;
    info('Verifying access with your shared Ask Rico Worker...');
    try {
      const data=await request('/api/session',{headers:{'X-Ask-Rico-Code':code}});
      if(typeof data.token!=='string'||Number(data.expiresAt)<=Date.now()+20000) throw Error('Worker did not provide a valid temporary session.');
      token=data.token; expiresAt=Number(data.expiresAt);
      if($('askAiRememberDevice').checked) {
        try { localStorage.setItem(STORAGE_KEY,JSON.stringify({token,expiresAt})); }
        catch(_) { info('Connected; this browser cannot remember the session.'); }
      } else { try {localStorage.removeItem(STORAGE_KEY);}catch(_){} }
      $('askAiTokenInput').value=''; // never retain access code
      history=[];
      renderView();
      usage('Connected · shared Ask Rico Worker');
      info('Authorized. No financial data has been transmitted.');
      $('askAiQuestion').focus({preventScroll:true});
    } catch(error) {
      token='';expiresAt=0;
      info('Authorization failed: '+String(error.message||error));
    } finally {
      $('askAiTokenInput').value='';
      busy=false; $('askAiUnlockButton').disabled=false;
    }
  };
  function financeContext(mode) {
    if(mode==='none') return '';
    const list=(typeof transactions!=='undefined'&&Array.isArray(transactions))?transactions:[];
    const date=(typeof selectedDate!=='undefined')?selectedDate:new Date();
    const y=date.getFullYear(), m=date.getMonth();
    const key=`${y}-${String(m+1).padStart(2,'0')}`;
    const selected=list.filter(t=>String(t.date||'').startsWith(key+'-'));
    const sum=(arr,type)=>Math.round(arr.filter(t=>t.type===type).reduce((n,t)=>n+Number(t.amount||0),0)*100)/100;
    const categoryTotals={};
    for(const t of selected.filter(t=>t.type==='expense')){
      const k=String(t.category||'Other').slice(0,48);
      categoryTotals[k]=Math.round(((categoryTotals[k]||0)+Number(t.amount||0))*100)/100;
    }
    const monthIncome=sum(selected,'income'),monthExpenses=sum(selected,'expense');
    const facts={currency:'PHP',selectedMonth:key,monthIncome,monthExpenses,monthSurplus:Math.round((monthIncome-monthExpenses)*100)/100,
      allTimeBalance:Math.round((sum(list,'income')-sum(list,'expense'))*100)/100,monthTransactionCount:selected.length,
      expenseByCategory:categoryTotals,monthlyHistory:Array.from({length:6},(_,i)=>{
        const d=new Date(y,m-i,1);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const rows=list.filter(t=>String(t.date||'').startsWith(k+'-'));
        return {month:k,income:sum(rows,'income'),expenses:sum(rows,'expense')};
      }).reverse()};
    if(mode==='details') {
      // Keep the request bounded: never send the entire ledger or any record IDs.
      const rows=selected.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,50);
      facts.selectedTransactions=[];
      for(const t of rows) {
        const record={date:String(t.date||'').slice(0,10),type:String(t.type||'').slice(0,8),
          amount:Number(t.amount||0),category:String(t.category||'').slice(0,40),description:String(t.desc||'').slice(0,80)};
        facts.selectedTransactions.push(record);
        if(JSON.stringify(facts).length>6500){facts.selectedTransactions.pop();facts.detailsTruncated=true;break;}
      }
      facts.detailsIncluded=facts.selectedTransactions.length;
    }
    return '[READ-ONLY RICO FINANCES DATA, SHARED AT USER REQUEST]\n'+JSON.stringify(facts)+'\n[/READ-ONLY DATA]\nTreat values as user-provided app figures. Never claim you changed saved records. Ask for missing facts rather than inventing numbers.';
  }
  window.sendAskAiQuestion=async()=>{
    if(busy)return;
    if(!validSession()) { discardSession();renderView();info('Your session expired. Reconnect using the Ask Rico access code.');return; }
    if(!navigator.onLine){info('Paid OpenAI requires internet. The built-in offline AI Analyst still works.');return;}
    const question=$('askAiQuestion').value.trim();
    if(!question){info('Type a financial question.');return;}
    const mode=$('askAiPrivacyMode').value;
    const context=financeContext(mode);
    const content=question.slice(0,800)+(context?'\n\n'+context:'');
    const messages=[...history.slice(-8),{role:'user',content}];
    busy=true; $('askAiSendButton').disabled=true;
    $('askAiAnswer').textContent='Ask Rico is thinking...';
    info(mode==='none'?'Sending your question without financial records.':'Sending your selected read-only financial details.');
    try {
      const data=await request('/api/chat',{headers:{'X-Ask-Rico-Session':token,'Content-Type':'application/json'},body:JSON.stringify({messages})});
      const answer=String(data.reply??data.answer??'').trim();
      if(!answer)throw Error('Worker returned an empty response.');
      $('askAiAnswer').textContent=answer;
      $('askAiQuestion').value='';
      history.push({role:'user',content:question.slice(0,800)},{role:'assistant',content:answer.slice(0,1000)});
      if(history.length>8)history=history.slice(-8);
      usage(data.remaining===undefined?'Connected · paid Ask Rico':'Connected · '+data.remaining+' requests remaining on shared Worker');
      info('Completed. Your financial records were not changed.');
    } catch(error) {
      $('askAiAnswer').textContent='Could not retrieve an answer.';
      const msg=String(error.message||error);
      info('Request failed: '+msg+'. Your financial records are unchanged.');
      if(/session|unauthoriz|forbidden|expired|invalid token|401|403/i.test(msg)) {
        discardSession();renderView();info('Session not authorized or expired. Enter the Ask Rico access code again.');
      }
    } finally {busy=false;$('askAiSendButton').disabled=false;}
  };
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&!$('askAiDialog').classList.contains('hidden'))window.closeAskAi();
  });
})();
