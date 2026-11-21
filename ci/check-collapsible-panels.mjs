// Synthetic mobile Cash Flow layout regression. No Firebase connection or personal
// data: collapsing the visual panels must never change their sync lifecycle.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const html=readFileSync('index.html','utf8');
const css=readFileSync('linked-panels.css','utf8');
const js=readFileSync('linked-panels-v1.8.14.js','utf8');
for(const [toggle,panel] of [['linkedBudgetToggle','linkedBudgetPanel'],['utilityLinkToggle','utilityLinkPanel']]){
 assert.match(html,new RegExp('id="'+toggle+'"[^>]*aria-expanded="false"[^>]*aria-controls="'+panel+'"'));
 assert.match(html,new RegExp('id="'+panel+'"[^>]*hidden'),'Panel '+panel+' must start collapsed');
}
assert.match(css,/\.linked-collapse-body\[hidden\]\{display:none!important\}/);
assert.match(readFileSync('linked-loans-v1.8.14.js','utf8'),/setInterval\(/,'Loan auto sync retained');
assert.match(readFileSync('linked-utilities-v1.8.14.js','utf8'),/onSnapshot\(/,'Firebase change listener retained');

const elements=new Map(),events=new Map(),observers=[];
class Observer{
 constructor(callback){this.callback=callback;this.sources=[];observers.push(this)}
 observe(node){this.sources.push(node)}
}
function node(id){
 const handlers=new Map(),attributes=new Map();
 return {
  id,textContent:'',hidden:false,handlers,attributes,
  setAttribute(name,value){attributes.set(name,value)},
  getAttribute(name){return attributes.get(name)??null},
  addEventListener(type,listener){handlers.set(type,listener)},
  tap(){handlers.get('click')?.()}
 };
}
function get(id){if(!elements.has(id))elements.set(id,node(id));return elements.get(id)}
get('linkedBudgetStatus').textContent='Connect Loan Tracker under Net Worth to view your family budget.';
get('linkedBudgetContent').hidden=true;
get('linkedBudgetRemaining').textContent='₱0.00';
get('utilityLinkStatus').textContent='Get a connection ID, authorize it once in Home Utilities.';
get('utilityLinkCount').textContent='0 paid expenses';
get('utilityLinkTotal').textContent='₱0.00';
const document={
 readyState:'loading',getElementById:get,
 addEventListener:(type,callback)=>events.set(type,callback)
};
const vm=createContext({document,MutationObserver:Observer,console});
new Script(js,{filename:'linked-panels-v1.8.14.js'}).runInContext(vm);
events.get('DOMContentLoaded')();
const b=get('linkedBudgetToggle'),u=get('utilityLinkToggle');
assert.equal(b.getAttribute('aria-expanded'),'false');
assert.equal(u.getAttribute('aria-expanded'),'false');
assert.equal(get('linkedBudgetPanel').hidden,true);
assert.equal(get('utilityLinkPanel').hidden,true);
assert.equal(get('linkedBudgetQuick').textContent,'Not connected');
assert.equal(get('utilityLinkQuick').textContent,'Connection needed');

b.tap();
assert.equal(get('linkedBudgetPanel').hidden,false);
assert.equal(get('utilityLinkPanel').hidden,true,'Other panel must remain collapsed');
assert.equal(b.getAttribute('aria-expanded'),'true');
u.tap();
assert.equal(get('utilityLinkPanel').hidden,false);
assert.equal(get('linkedBudgetPanel').hidden,false);
b.tap();
assert.equal(get('linkedBudgetPanel').hidden,true);
assert.equal(get('utilityLinkPanel').hidden,false,'Independent expanded state');

const emit=id=>{const source=get(id);observers.forEach(o=>{if(o.sources.includes(source))o.callback([])})};
get('linkedBudgetContent').hidden=false;
get('linkedBudgetRemaining').textContent='₱49,000.00';
emit('linkedBudgetRemaining');
assert.equal(get('linkedBudgetQuick').textContent,'Remaining ₱49,000.00');
get('utilityLinkStatus').textContent='Live Firebase sync · last updated today · read-only';
get('utilityLinkCount').textContent='3 paid expenses';
get('utilityLinkTotal').textContent='₱2,500.00';
emit('utilityLinkStatus');
assert.equal(get('utilityLinkQuick').textContent,'3 paid expenses · ₱2,500.00');
assert.equal(get('linkedBudgetPanel').hidden,true,'Auto-sync must not reopen a collapsed budget');
u.tap();
assert.equal(get('utilityLinkPanel').hidden,true);
assert.equal(get('utilityLinkQuick').textContent,'3 paid expenses · ₱2,500.00');
console.log('PASS: independent compact panels, accessible toggles, live summaries, loan polling and Firebase listener preserved');
