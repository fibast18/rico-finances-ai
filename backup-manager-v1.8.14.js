/* Rico Finances AI v1.8.14 — one portable backup for owned records.
   Explicitly excludes private pairing codes, Firebase Auth and AI sessions.
   Linked cloud data remains managed by its original app and is not modified.
*/
(() => {
 'use strict';
 const K={
  cash:'rico_finances_ai_txs',
  fallback:'rico_finances_ai_backup_fallback',
  net:'rico_finances_ai_net_worth_v1',
  preferences:'rico_finances_ai_preferences_v1',
  loans:'rico_finances_ai_loan_snapshot_v1',
  budget:'rico_finances_ai_monthly_budget_cache_v1',
  utilities:'rico_finances_utility_paid_snapshot_v1',
  excluded:'rico_finances_utility_paid_excluded_v1'
 };
 const MAX_SIZE=25*1024*1024;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 function readJSON(key,fallback) {
  const raw=localStorage.getItem(key);
  if(raw===null)return fallback;
  try{return JSON.parse(raw);}
  catch{throw Error('Stored app data could not be read: '+key+'. Your existing data was not changed.');}
 }
 function validateCash(rows) {
  if(!Array.isArray(rows)||rows.length>50000)throw Error('Invalid Cash Flow records.');
  for(const x of rows){
   if(!object(x)||!['income','expense'].includes(x.type)||
     !(typeof x.id==='number'||typeof x.id==='string')||
     !Number.isFinite(Number(x.amount))||Number(x.amount)<0||Number(x.amount)>1e12||
     typeof x.category!=='string'||x.category.length>400||
     typeof x.desc!=='string'||x.desc.length>2000||
     typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date))
     throw Error('Backup contains an invalid Cash Flow transaction.');
  }
  return rows;
 }
 function validateNet(rows) {
  if(!Array.isArray(rows)||rows.length>10000)throw Error('Invalid Net Worth records.');
  const ids=new Set();
  for(const x of rows){
   if(!object(x)||!['asset','liability'].includes(x.type)||
    typeof x.id!=='string'||!/^[a-z\d-]{5,100}$/i.test(x.id)||
    ids.has(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>80||
    typeof x.category!=='string'||x.category.length>120||
    !Number.isFinite(Number(x.amount))||Number(x.amount)<0||Number(x.amount)>1e15)
    throw Error('Backup contains an invalid Net Worth entry.');
   ids.add(x.id);
  }
  return rows;
 }
 function validatePreferences(value) {
  if(!object(value))throw Error('Invalid personal settings.');
  const result={};
  if(own(value,'appName')){
   if(typeof value.appName!=='string'||value.appName.length>120)throw Error('Invalid app name setting.');
   result.appName=value.appName;
  }
  if(own(value,'displayName')){
   if(typeof value.displayName!=='string'||value.displayName.length>120)throw Error('Invalid greeting setting.');
   result.displayName=value.displayName;
  }
  if(own(value,'photo')){
   if(typeof value.photo!=='string'||value.photo.length>15*1024*1024||
      (value.photo!==''&&!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(value.photo)))
       throw Error('Invalid profile photo setting.');
   result.photo=value.photo;
  }
  return result;
 }
 function optionalSnapshot(value,key) {
  if(value===null)return null;
  if(key==='excluded'){
   if(!Array.isArray(value)||value.length>3500||
      value.some(x=>typeof x!=='string'||x.length>200))throw Error('Invalid utility exclusions.');
  } else if(!object(value)){
   throw Error('Invalid linked-data cache: '+key);
  }
  const encoded=JSON.stringify(value);
  if(encoded.length>12*1024*1024)throw Error('Linked-data cache is too large: '+key);
  return value;
 }
 function makePayload() {
  const cash=window.RICO_MANUAL_CASH_FLOW?.()??readJSON(K.cash,readJSON(K.fallback,[]));
  const net=window.RICO_NET_WORTH?.manualItems?.()??readJSON(K.net,[]);
  const preferences=readJSON(K.preferences,{});
  const linked={
   loans:readJSON(K.loans,null),
   budget:readJSON(K.budget,null),
   utilities:readJSON(K.utilities,null),
   excluded:readJSON(K.excluded,null)
  };
  validateCash(cash);validateNet(net);validatePreferences(preferences);
  for(const key of Object.keys(linked))optionalSnapshot(linked[key],key);
  return {
   app:'Rico Finances AI',
   kind:'full-device-backup',
   schema:1,
   exportedAt:new Date().toISOString(),
   cashFlow:{transactions:cash},
   netWorth:{items:net},
   personalization:preferences,
   linkedCache:linked
  };
 }
 function planImport(data) {
  const changes=new Map();
  let kind='',countCash=null,countNet=null;
  if(Array.isArray(data)){
   validateCash(data);
   const text=JSON.stringify(data);
   changes.set(K.cash,text);changes.set(K.fallback,text);
   kind='legacy Cash Flow only';countCash=data.length;
  }else if(object(data)&&data.kind==='net-worth-backup'&&data.schema===1){
   validateNet(data.items);
   changes.set(K.net,JSON.stringify(data.items));
   kind='legacy Net Worth only';countNet=data.items.length;
  }else{
   if(!object(data)||data.app!=='Rico Finances AI'||
      data.kind!=='full-device-backup'||data.schema!==1||
      !object(data.cashFlow)||!object(data.netWorth)||
      !own(data.cashFlow,'transactions')||!own(data.netWorth,'items'))
     throw Error('Choose a Rico Finances AI full backup, or an older Cash Flow / Net Worth backup.');
   const cash=validateCash(data.cashFlow.transactions);
   const net=validateNet(data.netWorth.items);
   const cashText=JSON.stringify(cash);
   changes.set(K.cash,cashText);changes.set(K.fallback,cashText);
   changes.set(K.net,JSON.stringify(net));
   if(own(data,'personalization')&&data.personalization!==null){
    changes.set(K.preferences,JSON.stringify(validatePreferences(data.personalization)));
   }
   if(own(data,'linkedCache')&&data.linkedCache!==null){
    if(!object(data.linkedCache))throw Error('Invalid linked-data cache.');
    for(const name of ['loans','budget','utilities','excluded']){
     if(!own(data.linkedCache,name))continue;
     const value=optionalSnapshot(data.linkedCache[name],name);
     if(value!==null)changes.set(K[name],JSON.stringify(value));
     // A missing snapshot does not disconnect an existing authorized device.
    }
   }
   kind='full app backup';countCash=cash.length;countNet=net.length;
  }
  return {changes,kind,countCash,countNet};
 }
 function applyPlan(plan) {
  const prior=new Map();
  const touched=[];
  try{
   for(const [key,value] of plan.changes){
    prior.set(key,localStorage.getItem(key));
    localStorage.setItem(key,value);
    touched.push(key);
   }
  }catch(error){
   let restored=true;
   for(const key of touched.reverse()){
    try{const old=prior.get(key);if(old===null)localStorage.removeItem(key);
      else localStorage.setItem(key,old);}
    catch{restored=false;}
   }
   throw Error(restored?'Import could not be saved. Previous records were restored.':
     'Import could not be saved and rollback was incomplete. Do not edit data; use your saved backup.');
  }
 }
 async function importFile(file) {
  if(!file)return false;
  if(file.size>MAX_SIZE)throw Error('Backup file exceeds 25 MB.');
  const data=JSON.parse(await file.text());
  const plan=planImport(data);
  const amounts=(plan.countCash===null?'':plan.countCash+' Cash Flow transactions')+
    (plan.countNet===null?'':(plan.countCash===null?'':', ')+plan.countNet+' Net Worth entries');
  const message='Restore '+plan.kind+' ('+amounts+')? This replaces the included local records. '+
    'Linked apps will continue syncing from their own sources.';
  if(!window.confirm(message))return false;
  applyPlan(plan);
  // Re-read all ledgers from storage; never render stale pre-import arrays.
  window.location.reload();
  return true;
 }
 window.RICO_FULL_BACKUP={version:'1.8.14',makePayload,planImport,applyPlan,importFile};
})();
