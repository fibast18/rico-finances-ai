/* Rico Finances AI v1.8.12 — lightweight collapsible linked panels.
   A panel's visibility never pauses its source synchronization or changes data.
   Compact summaries mirror live values already rendered by the existing modules.
*/
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const text=id=>$(id)?.textContent?.trim()||'';
 const configs=[
  {
   toggle:'linkedBudgetToggle',panel:'linkedBudgetPanel',quick:'linkedBudgetQuick',
   watch:['linkedBudgetStatus','linkedBudgetContent','linkedBudgetRemaining'],
   summary() {
    if($('linkedBudgetContent')?.hidden===false) {
      const value=text('linkedBudgetRemaining');
      return value?'Remaining '+value:'Budget synced';
    }
    const status=text('linkedBudgetStatus');
    if(/connect loan tracker/i.test(status))return 'Not connected';
    if(/no saved family budget/i.test(status))return 'No budget saved';
    if(/offline/i.test(status))return 'Offline snapshot';
    return 'Checking budget…';
   }
  },
  {
   toggle:'utilityLinkToggle',panel:'utilityLinkPanel',quick:'utilityLinkQuick',
   watch:['utilityLinkStatus','utilityLinkCount','utilityLinkTotal','utilityLinkConnectedGuide'],
   summary() {
    const status=text('utilityLinkStatus');
    const count=text('utilityLinkCount'),total=text('utilityLinkTotal');
    if(/live firebase sync/i.test(status))return count+' · '+total;
    if(/offline saved snapshot/i.test(status))return 'Saved: '+total;
    if(/permission|authorization required|approve|connection failed|not published/i.test(status))return 'Connection needed';
    if(/connected/i.test(status)&&total)return count+' · '+total;
    return 'Not connected';
   }
  }
 ];
 function setup(config) {
  const toggle=$(config.toggle),panel=$(config.panel),quick=$(config.quick);
  if(!toggle||!panel||!quick)return;
  // Each section begins collapsed and can be toggled independently.
  const setExpanded=expanded=>{
   toggle.setAttribute('aria-expanded',String(expanded));
   panel.hidden=!expanded;
  };
  setExpanded(false);
  toggle.addEventListener('click',()=>setExpanded(toggle.getAttribute('aria-expanded')!=='true'));
  const update=()=>{quick.textContent=config.summary()};
  update();
  if(typeof MutationObserver!=='undefined') {
   const observer=new MutationObserver(update);
   for(const id of config.watch){
    const source=$(id);
    if(source)observer.observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
   }
  }
 }
 function init(){for(const config of configs)setup(config)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
})();
