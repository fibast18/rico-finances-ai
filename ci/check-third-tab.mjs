// v1.8.15 — synthetic mobile navigation and settings/Net Worth disclosures.
// No user financial records, Firebase sessions or network requests are accessed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const html=readFileSync('index.html','utf8');
const css=readFileSync('net-worth.css','utf8');
const source=readFileSync('net-worth-v1.8.15.js','utf8');
const pCash=html.indexOf('id="cashFlowPanel"'),pWorth=html.indexOf('id="netWorthPanel"'),pSettings=html.indexOf('id="dataSettingsPanel"');
assert(pCash>0&&pWorth>pCash&&pSettings>pWorth,'Third tab must follow Cash Flow and Net Worth');
assert.match(html,/<button id="tabDataSettings" role="tab" aria-controls="dataSettingsPanel"/);
const cashPart=html.slice(pCash,pWorth),worthPart=html.slice(pWorth,pSettings),settingPart=html.slice(pSettings,html.indexOf('</main>',pSettings));
for(const target of ['id="lastBackupText"','id="importFileInput"','checkForAppUpdates()',
 'id="netWorthSaveStatus"']){
 assert(settingPart.includes(target),'Missing moved settings control '+target);
 assert(!cashPart.includes(target)&&!worthPart.includes(target),'Settings control still on old tab: '+target);
 if(target.startsWith('id="'))assert.equal(html.split(target).length-1,1,'Duplicate control ID: '+target);
}
assert.match(settingPart,/onclick="exportData\(\)"/);
assert.match(settingPart,/onchange="importData\(event\)"/);
assert.match(settingPart,/Export All/);
assert.match(settingPart,/Import All/);
assert(!/Copy Records from Shared App|copyFromSharedFinances|id="nwImportFile"/.test(settingPart));
for(const [id,body] of [['nwAssetsCard','nwAssetsBody'],['loanLinkCard','nwLoanBody'],['nwDebtsCard','nwDebtsBody']]){
 const open=new RegExp('<details\\b[^>]*id="'+id+'"[^>]*>');
 const found=worthPart.match(open);
 assert(found,'Missing native disclosure '+id);
 assert(!/\\sopen\\b/.test(found[0]),'Net Worth disclosure must start collapsed');
 assert(worthPart.includes('id="'+body+'"'),'Existing list contents must be retained: '+body);
}
assert.match(css,/#dataSettingsPanel\[hidden\]/);
assert.match(css,/#addTransactionButton\[hidden\]/);
assert.match(css,/\.nw-disclosure\s*>\s*summary/);

const items=[
 {id:'asset-1',type:'asset',name:'Savings',category:'Bank Savings',amount:50},
 {id:'debt-1',type:'liability',name:'Utility loan',category:'Other Debt',amount:200}
];
const store=new Map([['rico_finances_ai_net_worth_v1',JSON.stringify(items)]]);
const originals=new Map(store);
const events=new Map(),nodes=new Map();
function element(){
 const handlers=new Map(),attributes=new Map();
 return {
  hidden:false,disabled:false,value:'',textContent:'',title:'',children:[],checked:false,tabIndex:0,
  classList:{toggle(){},add(){},remove(){}},
  append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x},
  setAttribute:(k,v)=>attributes.set(k,String(v)),getAttribute:k=>attributes.get(k)||null,
  addEventListener:(name,cb)=>handlers.set(name,cb),
  dispatch:(name,event={})=>handlers.get(name)?.(event),
  focus(){this.focused=true},add(){},reset(){},
 };
}
const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
let loanRefreshes=0,modalOpens=0;
$('nwDialog').hidden=true;
const document={
 readyState:'loading',getElementById:$,createElement:element,
 body:{classList:{add(){},remove(){}}},
 addEventListener:(name,cb)=>{const list=events.get(name)||[];list.push(cb);events.set(name,list)}
};
const ctx={
 window:null,globalThis:null,document,console,Intl,Date,Math,Number,String,Array,Map,Set,Promise,
 navigator:{onLine:false},localStorage:{
  getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,val),
  removeItem:key=>store.delete(key)
 },
 crypto:{randomUUID:()=> 'test-uuid'},File:class {},URL,
 setTimeout:()=>1,clearTimeout(){},alert(){},confirm:()=>true,
 addEventListener(){},scrollTo(){},
 RICO_CASH_FLOW_BALANCE:()=>700,
 RICO_LINKED_LOANS:{
  balanceDetails:()=>({amount:100,count:1,excludedManual:0}),
  isDuplicate:()=>false,render(){},refresh(){loanRefreshes++}
 },
 openModal(){modalOpens++}
};
ctx.window=ctx;ctx.globalThis=ctx;
new Script(source,{filename:'net-worth-v1.8.15.js'}).runInContext(createContext(ctx));
for(const cb of events.get('DOMContentLoaded')||[])cb();
assert.equal(ctx.RICO_NET_WORTH.totals().netWorth,450);
assert.match($('nwAssetsQuick').textContent,/750/);
assert.match($('nwLoanQuick').textContent,/100/);
assert.match($('nwDebtsQuick').textContent,/200/);
const tab=(id,event)=>$(id).dispatch(event||'click');
tab('tabDataSettings');
assert.equal($('cashFlowPanel').hidden,true);
assert.equal($('netWorthPanel').hidden,true);
assert.equal($('dataSettingsPanel').hidden,false);
assert.equal($('addTransactionButton').hidden,true,'FAB must be hidden on Settings');
assert.equal($('tabDataSettings').getAttribute('aria-selected'),'true');
ctx.openSectionAdd();assert.equal(modalOpens,0,'FAB cannot add an entry from settings');
tab('tabNetWorth');
assert.equal($('netWorthPanel').hidden,false);
assert.equal($('dataSettingsPanel').hidden,true);
assert.equal($('addTransactionButton').hidden,false);
assert.equal(loanRefreshes,1,'Net Worth switch still refreshes linked-loan snapshot');
tab('tabCashFlow');
assert.equal($('cashFlowPanel').hidden,false);
assert.equal($('netWorthPanel').hidden,true);
assert.equal($('tabCashFlow').getAttribute('aria-selected'),'true');
ctx.openSectionAdd();assert.equal(modalOpens,1);
const nav=$('mainTabNav');
nav.dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
assert.equal($('tabNetWorth').getAttribute('aria-selected'),'true');
nav.dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
assert.equal($('tabDataSettings').getAttribute('aria-selected'),'true');
nav.dispatch('keydown',{key:'ArrowRight',preventDefault(){}});
assert.equal($('tabCashFlow').getAttribute('aria-selected'),'true');
nav.dispatch('keydown',{key:'End',preventDefault(){}});
assert.equal($('tabDataSettings').getAttribute('aria-selected'),'true');
nav.dispatch('keydown',{key:'Home',preventDefault(){}});
assert.equal($('tabCashFlow').getAttribute('aria-selected'),'true');
assert.equal(store.get('rico_finances_ai_net_worth_v1'),originals.get('rico_finances_ai_net_worth_v1'),
 'No financial record modified when switching or collapsing');
console.log('PASS: third settings tab, moved existing backups, independently collapsed Net Worth lists, mobile tabs and unchanged stored data');
