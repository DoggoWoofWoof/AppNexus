// Standalone equivalents for conversation-only settings and layout selection.
(() => {
  const key = 'appnexus.demo.preferences.v1';
  let preferences = {view:'Phone',theme:'system'};
  try { preferences = {...preferences,...JSON.parse(localStorage.getItem(key)||'{}')}; } catch {}
  // Display preferences are separate from workspace records in IndexedDB.
  window.openai = {widgetState:null,setWidgetState:async()=>{}};
  function save() { try { localStorage.setItem(key,JSON.stringify(preferences)); } catch {} }
  function apply() {
    const variants = [...document.querySelectorAll('[data-variant]')];
    if (!variants.some(v=>v.dataset.variant===preferences.view)) preferences.view='Phone';
    for (const variant of variants) variant.hidden=variant.dataset.variant!==preferences.view;
    document.getElementById('demo-view').value=preferences.view;
    const scheme=['light','dark'].includes(preferences.theme)?preferences.theme:'light dark';
    document.documentElement.style.colorScheme=scheme;
    const product=document.getElementById('field-pro-responsive');
    if(product)product.style.colorScheme=scheme;
    document.getElementById('demo-theme').value=preferences.theme;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    document.getElementById('demo-view').addEventListener('change',e=>{
      const previousView=preferences.view;
      preferences.view=e.target.value;
      window.dispatchEvent(new CustomEvent('field-pro:preview-layout',{detail:{from:previousView,to:preferences.view}}));
      apply();save();
    });
    document.getElementById('demo-theme').addEventListener('change',e=>{preferences.theme=e.target.value;apply();save()});
    document.getElementById('demo-reset').addEventListener('click',()=>{if(confirm('Clear the active sample workspace, including notes and recordings on this browser?'))window.dispatchEvent(new CustomEvent('field-pro:reset'))});
    document.getElementById('demo-scenario').addEventListener('change',e=>window.dispatchEvent(new CustomEvent('field-pro:scenario',{detail:{scenario:e.target.value}})));
    document.getElementById('demo-booking-cancel').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('field-pro:booking-cancel')));
  });
})();
