// Synthetic iPhone VisualViewport regression for Asset/Debt input sheet.
// No personal finance data or browser credentials are read.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const css=readFileSync('net-worth.css','utf8');
assert.match(css,/#nwDialog\{[^}]*--nw-visible-height/,'Dialog must fit visible viewport');
assert.match(css,/\.nw-modal\{[^}]*overflow-y:auto/,'Modal content must scroll internally');
assert.match(css,/\.nw-modal-head\{[^}]*position:sticky/,'Title/close must stay accessible');

const nodes=new Map(),listeners=new Map(),scheduled=[];
const storage=new Map([
 ['rico_finances_ai_net_worth_v1',JSON.stringify([{id:'a-cash',type:'asset',name:'Test savings',category:'Bank Savings',amount:100}])]
]);
const viewport={
 height:730,offsetTop:0,
 handlers:new Map(),
 addEventListener(name,cb){this.handlers.set(name,cb)},
 emit(name){this.handlers.get(name)?.()}
};
function element(id){
 const handlers=new Map(),styleVars=new Map();
 return {
  id,hidden:false,value:'',textContent:'',disabled:false,tabIndex:0,scrollTop:0,
  style:{setProperty:(name,value)=>styleVars.set(name,value),removeProperty:(name)=>styleVars.delete(name),getPropertyValue:name=>styleVars.get(name)},
  classList:{toggle(){},add(){},remove(){}},
  children:[],append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items},
  setAttribute(){},add(){},reset(){},
  addEventListener(name,cb){handlers.set(name,cb)},
  dispatch(name,event={}){handlers.get(name)?.(event)},
  focus(){document.activeElement=this;get('nwDialog').dispatch('focusin',{target:this})},
  matches(selector){return selector==='input, select, textarea'},
  getBoundingClientRect(){const scroll=get('sheet').scrollTop;return {top:400-scroll,bottom:445-scroll,height:45}}
 };
}
function get(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);}
const sheet=get('sheet');
sheet.getBoundingClientRect=()=>({top:8,bottom:viewport.height-8,height:viewport.height-16});
const dialog=get('nwDialog');
dialog.hidden=true;
dialog.querySelector=selector=>selector==='.nw-modal'?sheet:null;
dialog.contains=node=>node===get('nwName')||node===get('nwAmount')||node===get('nwCategory');
const document={
 readyState:'loading',activeElement:get('launch'),
 getElementById:get,createElement:()=>element('new'),
 body:{classList:{add(){},remove(){}}},
 addEventListener(name,cb){listeners.set(name,cb)}
};
const context={
 window:null,globalThis:null,document,console,
 localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,v)=>storage.set(key,v)},
 visualViewport:viewport,innerHeight:730,
 setTimeout(cb){scheduled.push(cb);return scheduled.length},clearTimeout(){},
 addEventListener(name,cb){listeners.set('window:'+name,cb)},
 navigator:{},Date,Math,Number,String,Intl,Map,Set,Array,
 crypto:{randomUUID:()=> 'test-id'},File:class{},URL,confirm:()=>true,alert:()=>{}
};
context.window=context;context.globalThis=context;
const vm=createContext(context);
new Script(readFileSync('net-worth-v1.8.10.js','utf8'),{filename:'net-worth-v1.8.10.js'}).runInContext(vm);
listeners.get('DOMContentLoaded')();
const initial=storage.get('rico_finances_ai_net_worth_v1');
for(const kind of ['asset','liability']){
 context.openNetWorthForm(kind);
 assert.equal(dialog.hidden,false);
 assert.equal(dialog.style.getPropertyValue('--nw-visible-height'),'730px');
 assert.equal(document.activeElement,get('nwName'),'Name input receives focus immediately');
 get('nwName').value='Visible typed characters';
 viewport.height=355;
 viewport.emit('resize');
 assert.equal(dialog.style.getPropertyValue('--nw-visible-height'),'355px','Keyboard resizes sheet');
 assert.ok(sheet.scrollTop>50,'Active input automatically scrolls above keyboard');
 assert.equal(get('nwName').value,'Visible typed characters','Keyboard positioning cannot erase typed text');
 context.closeNetWorthForm();
 assert.equal(dialog.hidden,true);
 assert.equal(dialog.style.getPropertyValue('--nw-visible-height'),undefined,'Inline viewport dimensions reset after closing');
 viewport.height=730;sheet.scrollTop=0;
}
assert.equal(storage.get('rico_finances_ai_net_worth_v1'),initial,'Existing assets and debts were untouched');
console.log('PASS: keyboard-safe visible viewport, focused field auto-scroll, iPhone modal close, asset/debt data unchanged');
