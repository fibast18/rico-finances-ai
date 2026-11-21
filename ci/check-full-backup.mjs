// v1.8.15 — complete device backup, safe import and rollback.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';

const html=readFileSync('index.html','utf8');
const backup=readFileSync('backup-manager-v1.8.15.js','utf8');
const p=html.indexOf('id="dataSettingsPanel"');
const e=html.indexOf('</main>',p);
const settings=html.slice(p,e);
assert(p>0&&e>p);
assert.match(settings,/Export All/);
assert.match(settings,/Import All/);
assert.equal((settings.match(/onclick="exportData\(\)"/g)||[]).length,1);
assert.equal((settings.match(/onchange="importData\(event\)"/g)||[]).length,1);
assert(!/Copy Records from Shared App|copyFromSharedFinances|Net Worth Backup|nwImportFile/.test(settings));
assert(!html.includes('function copyFromSharedFinances()'),'Legacy shared-app copy must be removed');
assert.match(html,/window\.RICO_FULL_BACKUP\.makePayload\(\)/);
assert.match(html,/window\.RICO_FULL_BACKUP\.importFile\(file\)/);
assert.match(html,/backup-manager-v1\.8\.15\.js/);
assert(!/id="nwImportFile"/.test(html),'Separate Net Worth import must be removed');
const CASH='rico_finances_ai_txs', FALL='rico_finances_ai_backup_fallback';
const NET='rico_finances_ai_net_worth_v1';
const PREF='rico_finances_ai_preferences_v1';
const LOANS='rico_finances_ai_loan_snapshot_v1';
const BUDGET='rico_finances_ai_monthly_budget_cache_v1';
const UTILS='rico_finances_utility_paid_snapshot_v1';
const EXCLUDED='rico_finances_utility_paid_excluded_v1';
const SECRET='rico_finances_ai_loan_read_code_v1';
const AI_TOKEN='rico-finances-ai-ask-rico-session-v1';
const originalCash=[
 {id:1,type:'expense',amount:250,category:'Food',desc:'Groceries',date:'2026-11-19'},
 {id:2,type:'income',amount:2000,category:'Salary',desc:'Salary',date:'2026-11-20'}
];
const originalNet=[{id:'asset-123',type:'asset',name:'Savings',category:'Bank Savings',amount:300,updatedAt:'2026-11-20'}];
const values=new Map([
 [CASH,JSON.stringify(originalCash)], [FALL,JSON.stringify(originalCash)],
 [NET,JSON.stringify(originalNet)],
 [PREF,JSON.stringify({appName:'Finances Test',displayName:'Boss',photo:''})],
 [LOANS,JSON.stringify({loans:[{id:'A',name:'Loan',balance:300}],selected:['A'],asOf:'2026-11-21'})],
 [BUDGET,JSON.stringify({'2026-11':{budget:{available:true}}})],
 [UTILS,JSON.stringify({schema:1,source:'rico-utility-monitor',entries:[],dateBasis:'bill-or-record-date'})],
 [EXCLUDED,JSON.stringify(['utility-1'])],
 [SECRET,'rfnw_'+'x'.repeat(43)],
 [AI_TOKEN,'{"token":"private"}'],
 ['unrelated-other-app','do not touch']
]);
const storage={
 failNext:null,
 getItem(k){return values.has(k)?values.get(k):null},
 setItem(k,v){if(this.failNext===k){this.failNext=null;throw Error('simulated quota');}values.set(k,String(v))},
 removeItem(k){values.delete(k)}
};
let reloads=0,confirms=0,allow=true;
const context={
 window:null,globalThis:null,localStorage:storage,Date,Math,Number,JSON,Object,Map,Set,
 console,
 RICO_MANUAL_CASH_FLOW:()=>JSON.parse(values.get(CASH)),
 RICO_NET_WORTH:{manualItems:()=>JSON.parse(values.get(NET))},
 location:{reload(){reloads++}},
 confirm(_text){confirms++;return allow;}
};
context.window=context;context.globalThis=context;
new Script(backup,{filename:'backup-manager-v1.8.15.js'}).runInContext(createContext(context));
const manager=context.RICO_FULL_BACKUP;
assert.equal(manager.version,'1.8.15');
const payload=manager.makePayload();
assert.equal(payload.kind,'full-device-backup');
assert.equal(payload.schema,1);
assert.equal(payload.cashFlow.transactions.length,2);
assert.equal(payload.netWorth.items.length,1);
assert.equal(payload.personalization.displayName,'Boss');
assert.deepEqual(payload.linkedCache.excluded,['utility-1']);
const raw=JSON.stringify(payload);
assert(!raw.includes(values.get(SECRET)),'Private Loan Tracker linking code must not be exported');
assert(!raw.includes('private'),'AI login tokens must never be exported');
assert.equal(manager.planImport(payload).changes.size,8);
const file={size:raw.length,text:async()=>raw};
values.set(CASH,'[]');values.set(FALL,'[]');values.set(NET,'[]');
values.set(PREF,'{}');values.set(EXCLUDED,'[]');
assert.equal(await manager.importFile(file),true);
assert.equal(reloads,1);
assert.equal(JSON.parse(values.get(CASH)).length,2);
assert.equal(JSON.parse(values.get(NET)).length,1);
assert.equal(JSON.parse(values.get(PREF)).displayName,'Boss');
assert.deepEqual(JSON.parse(values.get(EXCLUDED)),['utility-1']);
assert.equal(values.get(SECRET),'rfnw_'+'x'.repeat(43),'Link credentials remain device-local');
assert.equal(values.get(AI_TOKEN),'{"token":"private"}','AI credentials unaffected');
assert.equal(values.get('unrelated-other-app'),'do not touch');
const beforeCancel=new Map(values);
allow=false;
assert.equal(await manager.importFile(file),false);
assert.equal(reloads,1);
assert.deepEqual([...values.entries()],[...beforeCancel.entries()]);
allow=true;
// Old Cash Flow-only JSON remains importable without overwriting Net Worth.
let plan=manager.planImport(originalCash);
assert.equal(plan.changes.size,2);
assert.equal(plan.kind,'legacy Cash Flow only');
// Old Net Worth-only backups are also accepted by the same Import button.
plan=manager.planImport({kind:'net-worth-backup',schema:1,items:originalNet});
assert.equal(plan.changes.size,1);
assert.equal(plan.kind,'legacy Net Worth only');
// Failed multi-key write rolls back every changed record.
const beforeFailure=new Map(values);
storage.failNext=NET;
assert.throws(()=>manager.applyPlan(manager.planImport({
 ...payload,cashFlow:{transactions:[]},netWorth:{items:[]}
})),/Previous records were restored/);
assert.deepEqual([...values.entries()],[...beforeFailure.entries()]);
assert.throws(()=>manager.planImport({kind:'full-device-backup',schema:1,app:'Rico Finances AI',cashFlow:{transactions:'bad'},netWorth:{items:[]}}),/Invalid Cash Flow/);
assert.throws(()=>manager.planImport({kind:'full-device-backup',schema:1,app:'Rico Finances AI',cashFlow:{transactions:[]},netWorth:{items:[{type:'asset',amount:1}]}}),/invalid Net Worth/);
console.log('PASS: single full-app export/import, legacy compatibility, protected tokens, restore confirmation, rollback and untouched other data');
