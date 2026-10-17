 // Bundled in the workspace closure after the capture UI.
 function candidateFor(person,item){
  const next=state.items.filter(i=>i.day===item.day&&!i.cancelled&&!i.done&&i.mode==='timed'&&i.time>item.time).sort((a,b)=>a.time.localeCompare(b.time))[0];
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const from=find(item.target).account||item.target,to=person.account;
  // Explicit fixture matrix, in seconds. Replace with a routing-provider adapter.
  const matrix={riverside:{riverside:0,westside:900,eastside:1200},westside:{riverside:960,westside:0,eastside:1020},eastside:{riverside:1260,westside:1080,eastside:0}};
  const incoming=matrix[from]?.[to],outgoing=!next||!['In-person visit','Case observation'].includes(next.type)?0:matrix[to]?.[find(next.target).account||next.target];
  const duration=Math.min(item.duration,30),available=next?minutes(next.time)-minutes(item.time):item.duration+30;
  const fit=Model.assessCandidate({previousSeconds:incoming,nextSeconds:outgoing,availableMinutes:available,durationMinutes:duration,availability:state.scenario==='no-candidates'?'unavailable':person.id==='alex'?'confirmed':'unknown'});
  const arrival=minutes(item.time)+Math.ceil((incoming||0)/60),time=String(Math.floor(arrival/60)).padStart(2,'0')+':'+String(arrival%60).padStart(2,'0');
  return {person,fit,incoming,outgoing,time,duration};
 }
 function recovery(){
  // Restore older saved recovery URLs into the shared Targets surface.
  const item=state.items.find(i=>i.id===state.gap?.visitId&&i.cancelled&&state.gaps.includes(i.id));
  if(!item)return `${backrow()}<h1>No open slot</h1>${button('Back to Today','data-nav="today"','primary')}`;
  state.replacingVisitId=item.id;state.page='targets';state.nav='targets';state.kind='hcp';state.targetSort='distance';state.mapAnchor=find(item.target).account||item.target;return targets();
 }
 function recordingBanner(){const s=recorder.current();return s&&s.scope===workspaceKey()&&['recording','interrupted','save-failed'].includes(s.status)&&(state.page!=='capture'||state.currentDraftId!==s.draftId)?`<div class="day-notice" role="status">${s.status==='recording'?'Recording in progress':'Recording needs attention'}<div class="day-actions">${button('Return to capture',`data-return-recording="${s.draftId}"`)}${button('Stop & save audio','data-record-stop')}</div></div>`:''}
 function bindMockFlows(){
  el.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>{
   const old=replacementItem();if(!old)return;const c=candidateFor(find(b.dataset.replace),old);
   if(!eligibleTarget(c.person,old)){state.notice='This alternative no longer fits. Review another option.';go('targets','targets');return}
   const replacement={...freshItem(c.person.id),day:old.day,mode:'timed',time:c.time,duration:c.duration,type:'In-person visit',confirmed:false,availability:c.fit.state,replacesVisitId:old.id};
   state.items.splice(state.items.indexOf(old)+1,0,replacement);state.day=old.day;closeGap(old.id);state.replacingVisitId=null;state.page='today';state.nav='today';state.history=[];state.notice='Visit planned with '+c.person.name+' at '+c.time+'. Confirm with the office first.';render();remember();
  });
  el.querySelector('[data-send-demo-booking]')?.addEventListener('click',async()=>{const i=state.items.find(x=>x.id===state.booking.id);Model.requestBooking(i);state.booking={...i};await persistWork().catch(()=>{});render()});
  el.querySelectorAll('[data-add-material]').forEach(b=>b.onclick=()=>{if(!state.materials.some(m=>m.target===state.entity&&m.name===b.dataset.addMaterial))state.materials.push({id:Model.id(),target:state.entity,targetLabel:find(state.entity).name,name:b.dataset.addMaterial,goal:plannedItem(state.entity)?.goal||'',status:'generating',dueAt:Date.now()+650});state.page='prep';render();remember()});
  el.querySelectorAll('[data-retry-material]').forEach(b=>b.onclick=()=>{const m=state.materials.find(m=>m.id===b.dataset.retryMaterial);m.status='generating';m.dueAt=Date.now()+500;render();remember()});
  el.querySelectorAll('[data-view-material]').forEach(b=>b.onclick=()=>{state.openMaterial=state.openMaterial===b.dataset.viewMaterial?null:b.dataset.viewMaterial;render()});
  el.querySelectorAll('[data-save-material]').forEach(b=>b.onclick=async()=>{try{if(state.scenario==='storage-full')throw new Error('Device storage is full.');const m=state.materials.find(m=>m.id===b.dataset.saveMaterial),id=m.offlineAsset||Model.id(),file=new File([m.content],'field-pro-demo-brief.txt',{type:'text/plain'});if(!m.offlineAsset)await deviceStore.putFile(workspaceKey(),id,file);m.offlineAsset=id;await persistWork();const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);render()}catch(error){state.captureError=error.message;render()}});
  el.querySelectorAll('[data-remove-material]').forEach(b=>b.onclick=async()=>{const m=state.materials.find(x=>x.id===b.dataset.removeMaterial);state.materials=state.materials.filter(x=>x!==m);await persistenceQueue.catch(()=>{});await deviceStore.deleteBundle(workspaceKey(),state,m?.offlineAsset?[m.offlineAsset]:[]);render()});
  el.querySelector('[data-return-recording]')?.addEventListener('click',e=>{const draft=state.drafts[e.currentTarget.dataset.returnRecording];if(draft)beginCapture(draft.source,draft.id)});
 }
