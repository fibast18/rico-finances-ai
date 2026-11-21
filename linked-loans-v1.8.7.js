/* v1.8.7 — read-only linked Pono Family Loan Tracker balances.
 * Private token: device-only localStorage, never placed in GitHub, URLs or backups.
 * Only authorized outstanding-loan totals are loaded. Cash flow records stay unchanged.
 */
(() => {
 'use strict';
 const ENDPOINT='https://pono-family-loan-tracker.rjpono.workers.dev/api/networth-read';
 const TOKEN_KEY='rico_finances_ai_loan_read_code_v1';
 const SNAPSHOT_KEY='rico_finances_ai_loan_snapshot_v1';
 const $=id=>document.getElementById(id);
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const money=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
 let token='',snapshot=null,selected=new Set(),lastRequest=0,loading=false;
 function load() {
  try{token=localStorage.getItem(TOKEN_KEY)||'';}catch{}
  try{
   const v=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');
   if(v&&Array.isArray(v.loans)&&v.loans.length<=500&&typeof v.asOf==='string') {
    snapshot=v;
    selected=new Set(Array.isArray(v.selected)?v.selected:[]);
   }
  }catch{}
 }
 function save() {
  try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({...snapshot,selected:[...selected]}));}
  catch(e){setStatus('Linked loans could not be saved for offline use. Check device storage.',true);}
 }
 function setStatus(s,error=false){const el=$('loanLinkStatus');if(el){el.textContent=s;el.classList.toggle('nw-link-error',error);}}
 function fmtDate(iso){const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'unknown time';}
 function balanceDetails(manualItems=[]) {
  const included=snapshot?.loans?.filter(l=>selected.has(l.id)&&l.balance>0)||[];
  const keys=new Set(included.map(l=>norm(l.name)));
  const duplicates=manualItems.filter(l=>l.type==='liability'&&keys.has(norm(l.name)));
  const amount=included.reduce((a,l)=>a+l.balance,0);
  const excludedManual=duplicates.reduce((a,l)=>a+Number(l.amount||0),0);
  return {amount:Math.round(amount*100)/100,count:included.length,excludedManual:Math.round(excludedManual*100)/100,duplicateNames:duplicates.map(l=>l.name)};
 }
 function isDuplicate(item) {
  return item?.type==='liability'&&snapshot?.loans?.some(l=>selected.has(l.id)&&l.balance>0&&norm(l.name)===norm(item.name));
 }
 function render() {
  const paired=!!token;
  $('loanLinkConnectArea').hidden=paired;
  $('loanLinkConnectedArea').hidden=!paired;
  const list=$('loanLinkItems');list.replaceChildren();
  const cache=snapshot;
  if(!cache){
   if(!paired)setStatus('Not connected. Get a private code from Loan Tracker → Backup & settings.');
   else if(!loading)setStatus('Connected code saved. Sync to load current loan balances.');
   return;
  }
  if(!loading){
   const stale=Date.now()-Date.parse(cache.fetchedAt)>24*3600000;
   setStatus('Last synced '+fmtDate(cache.fetchedAt)+' · Balances as of '+cache.asOf+
    (stale?' · Last online snapshot (may be outdated)':' · Scheduled-deduction estimates')+
    (paired?'':' · Disconnected offline copy'));
  }
  for(const loan of cache.loans){
   const row=document.createElement('label');row.className='nw-link-item';
   const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(loan.id);
   check.setAttribute('aria-label','Include '+loan.name+' in Net Worth');
   check.addEventListener('change',()=>{
    if(check.checked)selected.add(loan.id);else selected.delete(loan.id);
    save();window.RICO_NET_WORTH?.render();
   });
   const label=document.createElement('span');label.className='nw-link-name';label.textContent=loan.name;
   const value=document.createElement('strong');value.textContent=money(loan.balance);
   row.append(check,label,value);list.append(row);
  }
  const manual=window.RICO_NET_WORTH?.manualItems?.()||[];
  const details=balanceDetails(manual);
  $('loanLinkIncludedTotal').textContent=money(details.amount);
  $('loanLinkDuplicates').textContent=details.duplicateNames.length?
   'Matching manual debts are excluded from totals while their linked versions are selected: '+details.duplicateNames.join(', ')+'.':
   'Select only loans you want counted. All amounts are monitoring estimates.';
 }
 function validPayload(x) {
  if(!x||x.source!=='pono-family-loan-tracker'||!/^\d{4}-\d{2}-\d{2}$/.test(x.asOf)||!Array.isArray(x.loans)||x.loans.length>500)throw Error('Loan Tracker returned an invalid snapshot.');
  const ids=new Set();
  const loans=x.loans.map(l=>{
   if(!l||typeof l.id!=='string'||l.id.length>100||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>100||!Number.isFinite(l.balance)||l.balance<0||l.balance>1e12)throw Error('Loan Tracker returned an invalid loan.');
   ids.add(l.id);
   return {id:l.id,name:l.name,balance:Math.round(l.balance*100)/100};
  });
  return {loans,asOf:x.asOf,source:x.source,version:Number(x.version)||0,updatedAt:x.updatedAt||null,fetchedAt:new Date().toISOString()};
 }
 async function refresh(force=false) {
  if(!token||loading||!navigator.onLine)return;
  if(!force && Date.now()-lastRequest<10*60*1000)return;
  loading=true;lastRequest=Date.now();setStatus('Refreshing outstanding balances…');
  try{
   const r=await fetch(ENDPOINT,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{Authorization:'Bearer '+token}});
   if(!r.ok){
    let message='HTTP '+r.status;
    try{const body=await r.json();message=body.error||message;}catch{}
    throw Error(message);
   }
   const data=validPayload(await r.json());
   const manual=window.RICO_NET_WORTH?.manualItems?.()||[];
   if(!snapshot){const manualNames=new Set(manual.filter(l=>l.type==='liability').map(l=>norm(l.name)));
    selected=new Set(data.loans.filter(l=>l.balance>0&&!manualNames.has(norm(l.name))).map(l=>l.id));
   } else{
    // Preserve deliberate checkbox selection and include newly added loans unless they match a manual debt.
    const oldIds=new Set(snapshot.loans.map(l=>l.id)), manualNames=new Set(manual.filter(l=>l.type==='liability').map(l=>norm(l.name)));
    for(const l of data.loans)if(!oldIds.has(l.id)&&l.balance>0&&!manualNames.has(norm(l.name)))selected.add(l.id);
   }
   snapshot=data;save();
   $('loanLinkCode').value='';
   setStatus('Loan Tracker synchronized. Balances are read-only estimates.');
   render();window.RICO_NET_WORTH?.render();
  }catch(e){
   const message=/Failed to fetch|NetworkError|Load failed|cors/i.test(String(e?.message))?
    'Could not reach the protected Loan Tracker endpoint. Confirm Cloudflare Access permits this single read-only path; other routes remain protected.':
    'Sync failed: '+(e?.message||'Check your connection.');
   setStatus(message,true);
  }finally{loading=false;}
 }
 function connect(){
  const field=$('loanLinkCode'),value=field.value.trim();
  if(!/^rfnw_[A-Za-z0-9_-]{43}$/.test(value)){setStatus('Paste a valid private link code from Loan Tracker.',true);return;}
  try{localStorage.setItem(TOKEN_KEY,value);token=value;render();refresh(true);window.RICO_LINKED_BUDGET?.refresh(true);}
  catch{setStatus('Cannot save your connection on this device.',true);}
 }
 function disconnect(){
  if(!confirm('Disconnect Loan Tracker from this device? Cached linked loans will be cleared. Manual debts are not deleted.'))return;
  try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SNAPSHOT_KEY);}catch{}
  token='';snapshot=null;selected.clear();render();window.RICO_NET_WORTH?.render();window.RICO_LINKED_BUDGET?.disconnect();
 }
 function init(){
  // Cached linked balances must be applied immediately on reload/offline.
  // Previously they were visible in the linked-loan list but Net Worth stayed at zero
  // until a successful network refresh (or showed stale code due to mixed PWA assets).
  load();render();
  if(snapshot) window.RICO_NET_WORTH?.render();
  $('loanLinkConnect').addEventListener('click',connect);
  $('loanLinkRefresh').addEventListener('click',()=>refresh(true));
  $('loanLinkDisconnect').addEventListener('click',disconnect);
  window.addEventListener('online',()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  if(token)refresh(true);
 }
 window.RICO_LINKED_LOANS={version:'1.8.7',render,refresh,balanceDetails,isDuplicate,get snapshot(){return snapshot;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
})();
