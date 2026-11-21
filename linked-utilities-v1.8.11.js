/* Rico Finances AI v1.8.11 — securely linked, read-only paid utilities.
 * Only Firebase's minimal paid-expense summary is read. The utility database
 * and Cash Flow localStorage are NEVER written by this module.
 */
(() => {
 'use strict';
 const CONFIG={
   apiKey:"AIzaSyDfneSHThNcQ207t1g7OzJVfaUIrNVh2jo",
   authDomain:"rico-home-utilities.firebaseapp.com",
   projectId:"rico-home-utilities",
   storageBucket:"rico-home-utilities.firebasestorage.app",
   messagingSenderId:"153885893969",
   appId:"1:153885893969:web:6d3cc90243b3bd2d51df70"
 };
 const SDK='https://www.gstatic.com/firebasejs/13.4.0/';
 const CACHE_KEY='rico_finances_utility_paid_snapshot_v1';
 const EXCLUDE_KEY='rico_finances_utility_paid_excluded_v1';
 const CONNECT_KEY='rico_finances_utility_connected_v1';
 const TYPES={
  electricity:{category:'Bills & Utilities',name:'Electricity'},
  water:{category:'Bills & Utilities',name:'Water'},
  lpg:{category:'Bills & Utilities',name:'LPG / Cooking Gas'},
  car:{category:'Transportation',name:'Car Fuel'},
  motorcycle:{category:'Transportation',name:'Motorcycle Fuel'},
  camella:{category:'Bills & Utilities',name:'Camella Monthly Dues'}
 };
 const VALID_DATE=/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
 const money=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
 const $=id=>document.getElementById(id);
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 let rows=[],excluded=new Set(),updatedAt='',connected=false,deviceId='',unsubscribe=null,loading=false;
 let authContext=null,ready=false,showAll=false,errorMessage='',hasSnapshot=false;
 const identityMatchers={
  electricity:/electric|power|leyeco|kwh/i,
  water:/water|water district|mwd/i,
  lpg:/lpg|cooking gas|gas tank/i,
  car:/car|fuel|gasoline|diesel|petrol|petron|caltex|shell/i,
  motorcycle:/motorcycle|motorbike|fuel|gasoline|petrol|petron/i,
  camella:/camella|homeowner|hoa|monthly dues/i
 };
 function load(){
  try{
   const snap=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
   if(snap?.source==='rico-utility-monitor'&&Array.isArray(snap.entries)){
    acceptSnapshot(snap,false);
   }
  }catch(e){console.warn('Cached utilities unavailable:',e);}
  try{
   const ids=JSON.parse(localStorage.getItem(EXCLUDE_KEY)||'[]');
   if(Array.isArray(ids))excluded=new Set(ids.filter(x=>typeof x==='string'&&x.length<200).slice(0,3500));
  }catch{}
  try{connected=localStorage.getItem(CONNECT_KEY)==='yes';}catch{}
 }
 function validate(data){
  if(!data||data.source!=='rico-utility-monitor'||data.schema!==1||
     !Array.isArray(data.entries)||data.entries.length>3500||
     data.dateBasis!=='bill-or-record-date')throw Error('Invalid paid-utilities snapshot.');
  const seen=new Set();
  return data.entries.map(e=>{
   if(!e||typeof e.id!=='string'||e.id.length>180||seen.has(e.id)||
      !Object.hasOwn(TYPES,e.type)||!VALID_DATE.test(e.date)||
      !Number.isFinite(e.amount)||e.amount<=0||e.amount>1e12)
    throw Error('Invalid paid expense entry.');
   seen.add(e.id);
   return {sourceId:e.id,id:'util:'+e.id,type:'expense',utilityType:e.type,
    date:e.date,amount:Math.round(e.amount*100)/100,
    category:TYPES[e.type].category,
    desc:TYPES[e.type].name+' · Home Utilities',
    linkedUtility:true};
  });
 }
 function acceptSnapshot(data,save=true){
  const next=validate(data),old=JSON.stringify(rows);
  rows=next;updatedAt=typeof data.updatedAt==='string'?data.updatedAt:'';
  hasSnapshot=true;
  if(save){
   try{
    localStorage.setItem(CACHE_KEY,JSON.stringify({
      schema:1,source:'rico-utility-monitor',
      dateBasis:'bill-or-record-date',updatedAt,entries:data.entries
    }));
   }catch{setStatus('Live utilities connected, but offline cache could not be saved.',true);}
  }
  render();
  if(old!==JSON.stringify(rows))window.RICO_RENDER_CASH_FLOW?.();
 }
 function saveExclusions(){
  try{localStorage.setItem(EXCLUDE_KEY,JSON.stringify([...excluded]));}
  catch{setStatus('Could not save excluded utilities on this device.',true);}
 }
 function manualDuplicates(manual){
  const matched=new Set(),result=[];
  for(const linked of rows){
   if(excluded.has(linked.sourceId))continue;
   const match=manual.find(t=>{
    if(matched.has(t)||t?.type!=='expense'||t.date!==linked.date||
       Math.round(Number(t.amount)*100)!==Math.round(linked.amount*100)||
       t.category!==linked.category)return false;
    return identityMatchers[linked.utilityType].test(String(t.desc||''));
   });
   if(match){matched.add(match);result.push(match);}
  }
  return result;
 }
 function merge(manual=[]){
  const duplicates=new Set(manualDuplicates(manual));
  const included=rows.filter(r=>!excluded.has(r.sourceId));
  return [...manual.filter(r=>!duplicates.has(r)),...included];
 }
 function totals(manual=[]){
  const included=rows.filter(r=>!excluded.has(r.sourceId));
  const duplicates=manualDuplicates(manual);
  return {count:included.length,amount:included.reduce((s,x)=>s+x.amount,0),
    excluded:excluded.size,duplicateManual:duplicates.length,
    skippedManualAmount:duplicates.reduce((s,x)=>s+Number(x.amount||0),0)};
 }
 function setStatus(s,failed=false){
  const el=$('utilityLinkStatus');
  if(!el)return;
  el.textContent=s;el.classList.toggle('utility-link-error',failed);
 }
 function render(){
  const status=$('utilityLinkStatus');
  if(!status)return; // module is also unit-tested without a full page
  $('utilityLinkDeviceId').textContent=deviceId||'Press Get connection ID';
  $('utilityLinkAuthorizeGuide').hidden=!!ready;
  $('utilityLinkConnectedGuide').hidden=!ready;
  $('utilityLinkStatus').classList.toggle('utility-link-error',!!errorMessage);
  const entries=rows.filter(r=>!excluded.has(r.sourceId));
  const total=entries.reduce((s,r)=>s+r.amount,0);
  $('utilityLinkCount').textContent=entries.length+' paid expense'+(entries.length===1?'':'s');
  $('utilityLinkTotal').textContent=money(total);
  $('utilityLinkDuplicateStatus').textContent=totals(window.RICO_MANUAL_CASH_FLOW?.()||[]).duplicateManual+
    ' matching manual transaction(s) excluded from totals; original records preserved.';
  if(errorMessage)setStatus(errorMessage,true);
  else if(ready)setStatus('Live Firebase sync · last updated '+
    (updatedAt?new Date(updatedAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'unknown')+
    ' · read-only');
  else if(hasSnapshot)setStatus('Offline saved snapshot · authorize this Finances device for live updates.');
  else setStatus('Get a connection ID, authorize it once in Home Utilities, then connect here.');
  const list=$('utilityLinkRows');list.replaceChildren();
  const display=rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.sourceId.localeCompare(a.sourceId));
  const shown=showAll?display:display.slice(0,30);
  for(const entry of shown){
   const row=document.createElement('label');row.className='utility-link-row';
   const check=document.createElement('input');check.type='checkbox';
   check.checked=!excluded.has(entry.sourceId);
   check.setAttribute('aria-label','Include '+entry.desc+' on '+entry.date);
   check.addEventListener('change',()=>{
    if(check.checked)excluded.delete(entry.sourceId);else excluded.add(entry.sourceId);
    saveExclusions();render();window.RICO_RENDER_CASH_FLOW?.();
   });
   const label=document.createElement('span');label.textContent=entry.desc+' · '+entry.date;
   const amount=document.createElement('strong');amount.textContent=money(entry.amount);
   row.append(check,label,amount);list.append(row);
  }
  $('utilityLinkShowAll').hidden=display.length<=30;
  $('utilityLinkShowAll').textContent=showAll?'Show latest 30':'Show all '+display.length+' paid entries';
  $('utilityLinkCountNote').textContent='Paid entries use the recorded bill/purchase date (or Camella receipt date), not an assumed payment date. Unpaid bills are excluded.';
 }
 async function connectFirebase(){
  if(authContext)return authContext;
  const [app,auth,db]=await Promise.all([
   import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),
   import(SDK+'firebase-firestore.js')
  ]);
  const instance=app.initializeApp(CONFIG,'rico-finances-utilities-reader');
  const identity=auth.getAuth(instance);
  await identity.authStateReady();
  const current=identity.currentUser||(await auth.signInAnonymously(identity)).user;
  deviceId=current.uid;
  authContext={db,store:db.getFirestore(instance)};
  render();
  return authContext;
 }
 async function showDevice(){
  if(loading)return;
  loading=true;setStatus('Getting your private Finances connection ID…');
  try{await connectFirebase();errorMessage='';render();}
  catch(error){errorMessage='Connection ID unavailable: '+(error.message||'Check internet connection.');render();}
  finally{loading=false;}
 }
 async function start(){
  if(loading)return;
  loading=true;setStatus('Connecting to approved paid utilities…');
  try{
   const {db,store}=await connectFirebase();
   unsubscribe?.();unsubscribe=null;
   const ref=db.doc(store,'household','financePaidUtilities');
   unsubscribe=db.onSnapshot(ref,snapshot=>{
    loading=false;
    if(!snapshot.exists()){
      ready=false;errorMessage='Home Utilities has not published paid expenses yet. Open Home Utilities while online and check its Firebase connection.';
      render();return;
    }
    try{
     acceptSnapshot(snapshot.data(),true);ready=true;errorMessage='';
     connected=true;localStorage.setItem(CONNECT_KEY,'yes');
     render();
    }catch(error){ready=false;errorMessage='Utility snapshot was rejected: '+error.message;render();}
   },error=>{
    loading=false;ready=false;
    errorMessage=error.code==='permission-denied'
      ?'Authorization required. Copy your Finances ID, then open Home Utilities → Backup and approve it after publishing the new Firestore rules.'
      :'Could not connect to Firebase: '+(error.message||'Check connection.');
    unsubscribe?.();unsubscribe=null;render();
   });
  }catch(error){loading=false;ready=false;errorMessage='Connection failed: '+(error.message||'Check internet access.');render();}
 }
 function disconnect(){
  if(!confirm('Disconnect linked Home Utilities and remove its cached expenses from this device? Original financial and utility records will not be deleted.'))return;
  unsubscribe?.();unsubscribe=null;ready=false;connected=false;rows=[];excluded.clear();updatedAt='';hasSnapshot=false;
  try{localStorage.removeItem(CACHE_KEY);localStorage.removeItem(EXCLUDE_KEY);localStorage.removeItem(CONNECT_KEY);}catch{}
  errorMessage='';render();window.RICO_RENDER_CASH_FLOW?.();
 }
 function init(){
  load();render();
  $('utilityLinkGetId').addEventListener('click',showDevice);
  $('utilityLinkConnect').addEventListener('click',start);
  $('utilityLinkDisconnect').addEventListener('click',disconnect);
  $('utilityLinkShowAll').addEventListener('click',()=>{showAll=!showAll;render();});
  $('utilityLinkCopyId').addEventListener('click',async()=>{
   if(!deviceId)return;
   try{await navigator.clipboard.writeText(deviceId);setStatus('Connection ID copied. Paste it into Home Utilities → Backup.');}
   catch{setStatus('Select and copy the connection ID shown above.');}
  });
  window.addEventListener('online',()=>{if(connected&&!ready)start();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connected&&!ready)start();});
  if(connected&&navigator.onLine)start();
 }
 window.RICO_UTILITY_LINK={version:'1.8.11',merge,totals,validate,acceptSnapshot,render,
  get linkedRows(){return rows.slice();},get connected(){return ready;},get deviceId(){return deviceId}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
})();
