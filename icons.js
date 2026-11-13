/* Rico Finances compact, entirely local line icon renderer. */
(function () {
'use strict';
const shapes = {
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'chevron-left':'<path d="m15 18-6-6 6-6"/>',
 'chevron-right':'<path d="m9 18 6-6-6-6"/>',
 'arrow-down-left':'<path d="m17 7-10 10M17 17H7V7"/>',
 'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
 'pie-chart':'<path d="M21.2 15.9A10 10 0 1 1 8.1 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
 'list':'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
 'search':'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
 'receipt':'<path d="M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2zM8 9h8M8 13h8"/>',
 'download':'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 'upload':'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
 'refresh-cw':'<path d="M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4"/>',
 'plus-circle':'<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
 'x':'<path d="M18 6 6 18M6 6l12 12"/>',
 'pencil':'<path d="m15 5 4 4M3 21l4.5-1 12-12a2.12 2.12 0 0 0-3-3l-12 12L3 21Z"/>',
 'trash-2':'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 10v7M14 10v7"/>',
 'utensils':'<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M15 3v8h5V3M19 11v10"/>',
 'shopping-bag':'<path d="M6 7h12l1 14H5L6 7ZM9 8V6a3 3 0 0 1 6 0v2"/>',
 'zap':'<path d="m13 2-9 12h7l-1 8 10-12h-7l0-8Z"/>',
 'car':'<path d="M5 17h14l1-6-2-5H6l-2 5 1 6ZM5 17v2M19 17v2M4 11h16M7 14h2M15 14h2"/>',
 'film':'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5"/>',
 'heart-pulse':'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8ZM3 12h5l2-3 3 6 2-3h6"/>',
 'more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 'briefcase':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0"/>',
 'trending-up':'<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
 'gift':'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9H7a3 3 0 1 1 3-3l2 3ZM12 9h5a3 3 0 1 0-3-3l-2 3Z"/>',
 'tag':'<path d="M20 13 13 20 3 10V3h7l10 10Z"/><circle cx="7" cy="7" r="1"/>',
 'more-vertical':'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'
};
function createIcons() {
 document.querySelectorAll('i[data-lucide]').forEach(el => {
  const key=el.getAttribute('data-lucide');const content=shapes[key]||shapes.tag;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.setAttribute('class',el.getAttribute('class')||'w-5 h-5');svg.innerHTML=content;
  el.replaceWith(svg);
 });
}
window.lucide={createIcons};
})();
