/* Rico Finances AI v1.8.13 — private on-device Net Worth ledger.
 * Cash Flow balance is displayed as a read-only calculated asset (or estimated
 * deficit if negative); manual records and their storage remain separate.
 * Existing transaction backup file format and financial storage keys remain unchanged.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'rico_finances_ai_net_worth_v1';
  const CATEGORIES = {
    // Preserve legacy labels so previously saved records retain their original categories.
    asset: ['Cash on Hand', 'Bank Savings', 'Cash / Bank', 'Property / Land', 'Vehicle',
      'Gadgets / Electronics', 'Appliances / Furniture', 'Jewelry / Valuables',
      'Investments', 'Business', 'Receivables / Collectibles', 'Other Asset'],
    liability: ['Housing Loan', 'Personal Loan', 'Credit Card', 'Vehicle Loan',
      'Business Loan', 'Investment Loan', 'Unpaid Bills', 'Other Debt']
  };
  const $ = id => document.getElementById(id);
  const amountPHP = v => new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP', minimumFractionDigits:2, maximumFractionDigits:2}).format(v).replace('PHP','₱');
  const cleanItem = o => {
    if (!o || typeof o !== 'object') return null;
    const type = o.type;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0,80) : '';
    const amount = Number(o.amount);
    if (!['asset','liability'].includes(type) || !name || !Number.isFinite(amount) || amount < 0 || amount > 1e15) return null;
    const category = CATEGORIES[type].includes(o.category) ? o.category : CATEGORIES[type].at(-1);
    const id = typeof o.id === 'string' && /^[a-z\d-]{5,100}$/i.test(o.id) ? o.id : makeId();
    return {id, type, name, category, amount:Math.round(amount*100)/100, updatedAt:typeof o.updatedAt==='string'?o.updatedAt:new Date().toISOString()};
  };
  function makeId() { return (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)); }
  let items = [];
  let editingId = '';
  let kind = 'asset';
  let returnFocus = null;
  let page = 'cash';
  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(data)) throw Error('Invalid data');
      items = data.map(cleanItem).filter(Boolean);
    } catch (e) {
      console.error('Net worth could not be read; no data has been overwritten.', e);
      items = [];
      const note = $('netWorthSaveStatus');
      if (note) note.textContent = 'Could not read saved net worth records. Avoid adding entries until you recover the original backup.';
      readFailed = true;
    }
  };
  let readFailed = false;
  function persist(next) {
    if (readFailed) {alert('Net worth storage could not be read. Import a valid backup before editing.');return false;}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      items = next;
      return true;
    } catch (error) {
      alert('Could not save Net Worth on this phone. Storage may be full or unavailable. Existing values have not been changed.');
      return false;
    }
  }
  const roundPHP=n=>Math.round((n+Number.EPSILON)*100)/100;
  const autoCashBalance=()=>{
    const value=Number(window.RICO_CASH_FLOW_BALANCE?.()??0);
    return Number.isFinite(value)?roundPHP(value):0;
  };
  const isManualCashDuplicate=item=>item.type==='asset' &&
    /^cash on hand\s*\/\s*balance$/i.test(item.name.trim());
  function total(type) { return roundPHP(items.filter(x=>x.type===type).reduce((n,x)=>n+x.amount,0)); }
  function totals() {
    // Cash Flow balance is derived, never copied to localStorage or imported/exported.
    // A negative running balance is a cash-flow deficit, not an asset.
    const cashBalance=autoCashBalance();
    const cashAsset=Math.max(0,cashBalance),cashDeficit=Math.max(0,-cashBalance);
    const duplicatedManualCash=roundPHP(items.filter(isManualCashDuplicate).reduce((n,x)=>n+x.amount,0));
    const assets=roundPHP(total('asset')+cashAsset-duplicatedManualCash);
    const manualDebt=total('liability');
    const link=window.RICO_LINKED_LOANS?.balanceDetails(items)||{amount:0,count:0,excludedManual:0};
    const liabilities=roundPHP(manualDebt+link.amount-link.excludedManual+cashDeficit);
    return {assets,liabilities,netWorth:roundPHP(assets-liabilities),
      count:items.length,linkedDebt:link.amount,linkedCount:link.count,
      skippedDuplicates:link.excludedManual,cashBalance,cashAsset,cashDeficit,
      skippedDuplicateCash:duplicatedManualCash};
  }
  // Fixed SVG icons do not depend on asynchronous icon rendering or user strings.
  const PENCIL_ICON='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';
  const TRASH_ICON='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/></svg>';
  function calculatedRow(label,description,amount){
    const card=document.createElement('div');card.className='nw-item nw-item-calculated';
    const detail=document.createElement('div');detail.className='nw-item-info';
    const heading=document.createElement('strong');heading.textContent=label;
    const meta=document.createElement('span');meta.textContent=description;
    detail.append(heading,meta);
    const value=document.createElement('span');value.className='nw-item-amount';value.textContent=amountPHP(amount);
    const indicator=document.createElement('span');indicator.className='nw-item-auto-tag';indicator.textContent='AUTO';
    card.append(detail,value,indicator);
    return card;
  }
  function renderList(type,t=totals()) {
    const list=$(type==='asset'?'netWorthAssetList':'netWorthLiabilityList');
    list.replaceChildren();
    // This entry is computed live; it is intentionally NOT stored as a manual asset.
    if(type==='asset') list.append(calculatedRow('Cash on Hand / Balance','Live · Cash Flow transactions',t.cashAsset));
    if(type==='liability'&&t.cashDeficit>0) {
      list.append(calculatedRow('Cash Flow deficit','Estimated · negative running balance',t.cashDeficit));
    }
    const matches=items.filter(x=>x.type===type).sort((a,b)=>b.amount-a.amount || a.name.localeCompare(b.name));
    if (!matches.length && type==='liability' && t.cashDeficit===0) {
      const hint=document.createElement('p');hint.className='nw-empty';hint.textContent='No manual debts yet. Linked loans appear in the separate card below.';list.append(hint);return;
    }
    matches.forEach(item=>{
      const card=document.createElement('div');card.className='nw-item';
      const detail=document.createElement('div');detail.className='nw-item-info';
      const heading=document.createElement('strong');heading.textContent=item.name;
      const meta=document.createElement('span');
      meta.textContent=item.category+
        (window.RICO_LINKED_LOANS?.isDuplicate(item)?' · Linked debt counted instead':'')+
        (isManualCashDuplicate(item)?' · Automatic cash balance counted instead':'');
      detail.append(heading,meta);
      const value=document.createElement('span');value.className='nw-item-amount';value.textContent=amountPHP(item.amount);
      const actions=document.createElement('div');actions.className='nw-item-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='nw-icon-button';
      edit.innerHTML=PENCIL_ICON;edit.title='Edit '+item.name;edit.setAttribute('aria-label','Edit '+item.name);
      edit.addEventListener('click',()=>openForm(item.type,item.id));
      const del=document.createElement('button');del.type='button';del.className='nw-icon-button nw-delete';
      del.innerHTML=TRASH_ICON;del.title='Delete '+item.name;del.setAttribute('aria-label','Delete '+item.name);
      del.addEventListener('click',()=>remove(item.id));
      actions.append(edit,del);card.append(detail,value,actions);list.append(card);
    });
  }
  function render() {
    const t=totals();
    $('netWorthTotal').textContent=amountPHP(t.netWorth);
    $('netWorthTotal').classList.toggle('nw-negative',t.netWorth<0);
    $('netWorthAssets').textContent=amountPHP(t.assets);
    $('netWorthLiabilities').textContent=amountPHP(t.liabilities);
    const manualAssets=items.filter(x=>x.type==='asset').length;
    const manualDebts=items.filter(x=>x.type==='liability').length;
    $('netWorthAssetCount').textContent=manualAssets+' manual + 1 auto';
    $('netWorthLiabilityCount').textContent=manualDebts+' manual'+(t.cashDeficit>0?' + 1 deficit':'');
    // Summary figures remain visible even when their lists are collapsed.
    $('nwAssetsQuick').textContent=amountPHP(t.assets);
    $('nwLoanQuick').textContent=amountPHP(t.linkedDebt);
    $('nwDebtsQuick').textContent=amountPHP(Math.max(0,t.liabilities-t.linkedDebt));
    renderList('asset',t);renderList('liability',t);window.RICO_LINKED_LOANS?.render();
  }
  function setKind(next) {
    kind=next;
    const select=$('nwCategory');
    select.replaceChildren();
    CATEGORIES[next].forEach(c=>{const option=document.createElement('option');option.value=c;option.textContent=c;select.add(option);});
    $('nwAssetType').classList.toggle('selected',next==='asset');
    $('nwLiabilityType').classList.toggle('selected',next==='liability');
    $('nwAssetType').setAttribute('aria-pressed',String(next==='asset'));
    $('nwLiabilityType').setAttribute('aria-pressed',String(next==='liability'));
    $('nwAmountLabel').textContent=next==='asset'?'Current value (₱)':'Outstanding balance (₱)';
  }
  // iOS Safari/Home Screen apps can leave fixed bottom sheets behind the virtual
  // keyboard. Follow the *visual* viewport, then scroll only the sheet content.
  // This doesn't scroll the background app or change any financial records.
  let keyboardScrollTimer=0;
  function syncModalViewport() {
    const dialog=$('nwDialog');
    if(dialog.hidden)return;
    const viewport=window.visualViewport;
    const h=viewport?.height||window.innerHeight;
    const offset=viewport?.offsetTop||0;
    if(Number.isFinite(h)&&h>0)dialog.style.setProperty('--nw-visible-height',h+'px');
    if(Number.isFinite(offset))dialog.style.setProperty('--nw-visible-top',offset+'px');
    keepActiveControlVisible();
  }
  function keepActiveControlVisible() {
    const dialog=$('nwDialog');
    if(dialog.hidden)return;
    const active=document.activeElement;
    const sheet=dialog.querySelector('.nw-modal');
    if(!sheet||!active||!dialog.contains(active)||!active.getBoundingClientRect)return;
    const field=active.getBoundingClientRect(),box=sheet.getBoundingClientRect();
    const lower=box.bottom-22,upper=box.top+Math.min(56,box.height/5);
    if(field.bottom>lower)sheet.scrollTop+=field.bottom-lower;
    else if(field.top<upper)sheet.scrollTop-=upper-field.top;
  }
  function scheduleKeyboardReposition() {
    if($('nwDialog').hidden)return;
    syncModalViewport();
    clearTimeout(keyboardScrollTimer);
    // Keyboard expands over several animation frames, especially in iOS PWA.
    keyboardScrollTimer=setTimeout(()=>syncModalViewport(),300);
  }
  function resetModalViewport() {
    clearTimeout(keyboardScrollTimer);
    const style=$('nwDialog').style;
    style.removeProperty('--nw-visible-height');
    style.removeProperty('--nw-visible-top');
  }
  function openForm(type='asset',id='') {
    if(readFailed){alert('Net Worth data could not be loaded. Restore a backup before editing.');return;}
    const record=items.find(x=>x.id===id);
    editingId=record?.id||'';
    returnFocus=document.activeElement;
    $('nwForm').reset();
    setKind(record?.type||type);
    $('nwDialogTitle').textContent=record?'Edit entry':'Add to Net Worth';
    $('nwName').value=record?.name||'';
    $('nwAmount').value=record?.amount??'';
    if(record)$('nwCategory').value=record.category;
    $('nwDialog').hidden=false;
    document.body.classList.add('nw-modal-open');
    syncModalViewport();
    $('nwName').focus({preventScroll:true});
    scheduleKeyboardReposition();
  }
  function closeForm() {
    $('nwDialog').hidden=true;
    resetModalViewport();
    document.body.classList.remove('nw-modal-open');
    returnFocus?.focus?.({preventScroll:true});
  }
  function save(e) {
    e.preventDefault();
    const name=$('nwName').value.trim(), amount=Number($('nwAmount').value), category=$('nwCategory').value;
    if(!name || !Number.isFinite(amount) || amount<0 || amount>1e15) {alert('Enter a name and valid non-negative amount.');return;}
    const item=cleanItem({id:editingId||makeId(),type:kind,name,amount,category,updatedAt:new Date().toISOString()});
    if(!item){alert('Check the name and amount.');return;}
    const exists=items.some(x=>x.id===editingId);
    const next=exists?items.map(x=>x.id===editingId?item:x):[...items,item];
    if(persist(next)){render();closeForm();}
  }
  function remove(id) {
    const record=items.find(x=>x.id===id);if(!record)return;
    if(confirm('Delete "'+record.name+'" from Net Worth?')){if(persist(items.filter(x=>x.id!==id)))render();}
  }
  function switchTab(next) {
    page=['cash','networth','settings'].includes(next)?next:'cash';
    const tabs=[
      {key:'cash',panel:'cashFlowPanel',button:'tabCashFlow'},
      {key:'networth',panel:'netWorthPanel',button:'tabNetWorth'},
      {key:'settings',panel:'dataSettingsPanel',button:'tabDataSettings'}
    ];
    for(const tab of tabs){
      const active=page===tab.key;
      $(tab.panel).hidden=!active;
      $(tab.button).setAttribute('aria-selected',String(active));
      $(tab.button).tabIndex=active?0:-1;
    }
    const fab=$('addTransactionButton');
    // A Settings screen must not accidentally create an asset when + is tapped.
    fab.hidden=page==='settings';
    if(page!=='settings'){
      fab.setAttribute('aria-label',page==='cash'?'Add transaction':'Add asset or debt');
      fab.title=page==='cash'?'Add transaction':'Add asset or debt';
    }
    if(page==='networth'){render();window.RICO_LINKED_LOANS?.refresh();}
    window.scrollTo?.({top:0,behavior:'instant'});
  }
  async function exportNetWorth() {
    const payload={app:'Rico Finances AI',kind:'net-worth-backup',schema:1,exportedAt:new Date().toISOString(),items};
    const data=JSON.stringify(payload,null,2);
    const filename='rico-finances-ai-net-worth-'+new Date().toISOString().slice(0,10)+'.json';
    const file=new File([data],filename,{type:'application/json'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
      try {await navigator.share({files:[file],title:'Net Worth backup'});return;} catch (e) {if(e?.name==='AbortError')return;}
    }
    const blobUrl=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=blobUrl;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
    alert('Backup requested. Verify '+filename+' was saved in Files / Downloads.');
  }
  async function importNetWorth(event) {
    const input=event.target;
    if(!input.files?.length)return;
    try {
      const data=JSON.parse(await input.files[0].text());
      if(!data || data.kind!=='net-worth-backup' || data.schema!==1 || !Array.isArray(data.items))throw Error('Select a Net Worth backup exported from this app.');
      if(data.items.length>10000)throw Error('Backup has too many entries.');
      const parsed=data.items.map(cleanItem);
      if(parsed.some(x=>!x))throw Error('Backup has an invalid entry.');
      if(new Set(parsed.map(x=>x.id)).size!==parsed.length)throw Error('Backup contains duplicate entry identifiers.');
      if(!confirm('Replace all '+items.length+' saved Net Worth entries with '+parsed.length+' from this file? Transactions will not change.'))return;
      const previousReadFailure=readFailed;readFailed=false;
      if(!persist(parsed))readFailed=previousReadFailure;
      else {render();$('netWorthSaveStatus').textContent='Net Worth restored successfully.';}
    } catch(error) {alert('Net Worth import failed: '+(error.message||'Invalid file')+'. Existing values were not changed.');}
    finally {input.value='';}
  }
  // Snapshot is read only; authorized Ask Rico requests may include a compact summary.
  function aiSummary() {
    const t=totals();
    const byType=type=>items.filter(x=>x.type===type).sort((a,b)=>b.amount-a.amount).slice(0,3)
      .map(x=>x.name.slice(0,22)+':'+Math.round(x.amount)).join('; ');
    return `NET WORTH assets=${t.assets}, total debts=${t.liabilities}, net=${t.netWorth}; automatically linked Cash Flow balance=${t.cashBalance} (cash asset=${t.cashAsset}, deficit=${t.cashDeficit}); manually entered items=${t.count}; selected read-only Loan Tracker debt=${t.linkedDebt} across ${t.linkedCount} loans; excluded duplicate manual debt=${t.skippedDuplicates}. Top assets [${byType('asset')}]; manual debts [${byType('liability')}]. Linked balances are estimated after scheduled deductions and may be stale offline. This is NOT the cash-flow income-minus-expenses balance.`;
  }
  window.RICO_NET_WORTH={version:'1.8.13',init,totals,aiSummary,render,manualItems:()=>items.map(x=>({...x}))};
  window.switchMainTab=switchTab;
  window.openNetWorthForm=openForm;
  window.closeNetWorthForm=closeForm;
  window.setNetWorthKind=setKind;
  window.saveNetWorthEntry=save;
  window.exportNetWorth=exportNetWorth;
  window.importNetWorth=importNetWorth;
  window.openSectionAdd=()=> {if(page==='cash')window.openModal();else if(page==='networth')openForm('asset');};
  function init() {
    load();render();
    $('nwForm').addEventListener('submit',save);
    $('nwDialog').addEventListener('click',e=>{if(e.target===$('nwDialog'))closeForm();});
    $('nwDialog').addEventListener('focusin',e=>{
      if(e.target?.matches?.('input, select, textarea'))scheduleKeyboardReposition();
    });
    const viewport=window.visualViewport;
    viewport?.addEventListener('resize',scheduleKeyboardReposition);
    viewport?.addEventListener('scroll',scheduleKeyboardReposition);
    window.addEventListener('resize',scheduleKeyboardReposition);
    document.addEventListener('keydown',e=>{
      if(!$('nwDialog').hidden && e.key==='Escape'){e.preventDefault();closeForm();}
      if(!$('nwDialog').hidden && e.key==='Tab'){
        const controls=[...$('nwDialog').querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.offsetParent!==null);
        if(controls.length){const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      }
    });
    $('tabCashFlow').addEventListener('click',()=>switchTab('cash'));
    $('tabNetWorth').addEventListener('click',()=>switchTab('networth'));
    $('tabDataSettings').addEventListener('click',()=>switchTab('settings'));
    $('mainTabNav').addEventListener('keydown',e=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
      e.preventDefault();
      const tabs=['cash','networth','settings'];
      const buttons=['tabCashFlow','tabNetWorth','tabDataSettings'];
      const position=tabs.indexOf(page);
      const next=e.key==='Home'?0:e.key==='End'?2:
        (position+(e.key==='ArrowRight'?1:2))%3;
      switchTab(tabs[next]);$(buttons[next]).focus();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
