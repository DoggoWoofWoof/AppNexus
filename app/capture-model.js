(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldProModel=api})(globalThis,()=>{
 'use strict';
 const clone=value=>structuredClone(value);
 const id=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const outcomes=['Met','Attempted','Rescheduled'];
 const scopeKey=scope=>JSON.stringify([scope.companyId,scope.repId]);
 function makeDraft({source,attendees=[],visitId=null,day='today',intent='note',language='English',draftId=id()}){
  return {id:draftId,source,attendees:[...attendees],visitId,day,intent,language,note:'',follow:'',due:'2026-10-18',outcome:null,mediaIds:[],audioIds:[],fileIds:[],updatedAt:Date.now()};
 }
 function commit(state,draftId,outcome){
  const d=state.drafts[draftId];if(!d){const existing=state.notes.find(n=>n.id===draftId);if(existing&&existing.outcome===outcome)return existing;throw new Error('This draft is unavailable.')}
  if(!outcomes.includes(outcome))throw new Error('Choose the actual visit outcome.');
  if(!d.attendees.length)throw new Error('Choose who this conversation belongs to.');
  if(d.follow.trim()&&!/^\d{4}-\d{2}-\d{2}$/.test(d.due))throw new Error('Choose a due date for the follow-up.');
  let n=state.notes.find(x=>x.id===(d.editingNote||d.id));
  const fresh=!n;
  if(!n){n={id:d.id,source:d.source,target:d.attendees[0],attendees:[...d.attendees],visitId:d.visitId,day:d.day,meetingDate:d.meetingDate||(d.day==='tomorrow'?'2026-10-18':'2026-10-17'),createdAt:Date.now(),originalText:d.note,originalAudioIds:[...(d.audioIds||[])],originalFileIds:[...(d.fileIds||[])],language:d.language};state.notes.unshift(n)}
  Object.assign(n,{text:d.note,target:d.attendees[0],attendees:[...d.attendees],outcome,updatedAt:Date.now(),status:n.status||'device',captureIntent:d.intent});
  if(!fresh){n.correctedTranscript=d.note;n.summaryStale=!!n.summary;n.originalAudioIds=[...new Set([...(n.originalAudioIds||[]),...(d.audioIds||[])])];n.originalFileIds=[...new Set([...(n.originalFileIds||[]),...(d.fileIds||[])])]}
  if(fresh&&(d.note.trim()||d.mediaIds.length)){
   n.processing='queued';n.job={id:'process:'+n.id,stage:'upload',dueAt:Date.now()+350,attempt:0};
  }
  const task=state.tasks.find(t=>t.note===n.id&&t.manual);
  if(d.follow.trim()){
   const target=d.attendees.includes(d.followTarget)?d.followTarget:n.target;
   if(task)Object.assign(task,{text:d.follow.trim(),due:d.due,target});
   else state.tasks.push({id:'follow:'+n.id,note:n.id,target,text:d.follow.trim(),due:d.due,done:false,manual:true});
  }else if(task)state.tasks=state.tasks.filter(t=>t.id!==task.id);
  const visit=state.items.find(i=>i.id===n.visitId&&i.day===n.day&&!i.cancelled);
  if(visit){visit.done=outcome!=='Rescheduled';visit.outcome=outcome;if(outcome==='Rescheduled'){visit.confirmed=false;visit.bookingStatus='reschedule-needed';delete visit.requestId;delete visit.responseDue}}
  delete state.drafts[draftId];return n;
 }
 function acceptSuggestion(state,noteId,suggestionId,due){
  const n=state.notes.find(x=>x.id===noteId&&!x.deletedAt),s=n?.suggestions?.find(x=>x.id===suggestionId);
  if(!s)throw new Error('Suggestion unavailable.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due||''))throw new Error('Confirm a due date before creating a follow-up.');
  const key='suggestion:'+noteId+':'+suggestionId;
  let task=state.tasks.find(t=>t.id===key);
  if(!task){task={id:key,note:noteId,target:n.target,text:s.text,due,done:false,manual:false};state.tasks.push(task)}
  s.accepted=true;return task;
 }
 function search(state,query='',kind='all'){
  const q=query.trim().toLocaleLowerCase();return state.notes.filter(n=>(kind==='trash'?!!n.deletedAt:!n.deletedAt)&&(kind!=='audio'||n.originalAudioIds?.length)&&(kind!=='attention'||n.processing==='failed'||n.suggestions?.some(s=>!s.accepted&&!s.dismissed))).filter(n=>[n.text,n.originalText,n.correctedTranscript,n.summary,...(n.attendees||[]),n.day,n.meetingDate||(n.day==='tomorrow'?'2026-10-18':'2026-10-17')].join(' ').toLocaleLowerCase().includes(q));
 }
 function mockTick(state,now=Date.now()){
  if(state.scenario==='offline')return false;
  let changed=false;
  for(const n of state.notes){
   if(n.deletedAt||!n.job||n.job.dueAt>now||n.processing==='failed')continue;
   changed=true;
   if(state.scenario==='transcription-fails'&&n.job.stage==='transcribe'){n.processing='failed';n.error='Demo transcription failed. Your original input is still saved.';continue}
   if(n.job.stage==='upload'){n.status='mock-remote';n.processing='transcribing';n.job.stage='transcribe';n.job.dueAt=now+450}
   else if(n.job.stage==='transcribe'){
    n.transcriptOriginal=n.transcriptOriginal||n.originalText||'Demo transcript: We discussed the account priorities. Please send the procedure mix report.';
    n.transcriptIsMock=!n.originalText;n.processing='analyzing';n.job.stage='analyze';n.job.dueAt=now+450;
   }else{
    n.summary='Demo summary · '+(n.correctedTranscript||n.transcriptOriginal||n.originalText||'Visit outcome recorded.').slice(0,220);n.summaryStale=false;
    n.suggestions=n.suggestions||(/report|रिपोर्ट/i.test(n.correctedTranscript||n.transcriptOriginal||'')?[{id:'send-report',text:'Review the requested report',proposedDue:'2026-10-18',accepted:false}]:[]);
    n.processing='ready';n.job=null;
   }
  }
  for(const m of state.materials||[]){if(m.status==='generating'&&m.dueAt<=now){changed=true;m.status=state.scenario==='report-fails'?'failed':'ready';m.updatedAt=now;m.content='DEMO MEETING BRIEF\n'+m.name+'\nPrepared for '+(m.targetLabel||m.target)+'\n'+(m.goal||'Review account priorities.')+'\nGenerated '+new Date(now).toISOString()+'\nIllustrative material. No commercial or clinical dataset was queried.'}}
  for(const i of state.items){if(i.bookingStatus==='requested'&&i.responseDue<=now){changed=applyBookingEvent(state,{visitId:i.id,requestId:i.requestId,id:'response:'+i.requestId,version:(i.providerVersion||0)+1,status:state.scenario==='booking-declined'?'declined':'confirmed'})||changed}}
  return changed;
 }
 function requestBooking(item,now=Date.now()){
  item.requestId=id();item.providerVersion=0;item.providerEvents=[];item.confirmed=false;item.cancelled=false;item.bookingStatus='requested';item.responseDue=now+1800;return item.requestId;
 }
 function applyBookingEvent(state,event){
  const i=state.items.find(i=>i.id===event.visitId);
  if(!i||i.requestId!==event.requestId||event.version<=(i.providerVersion||0)||(i.providerEvents||[]).includes(event.id)||!['confirmed','declined','cancelled'].includes(event.status))return false;
  i.providerVersion=event.version;i.providerEvents=[...(i.providerEvents||[]),event.id];i.confirmed=event.status==='confirmed';i.bookingStatus=event.status;i.confirmationSource='Mock office response';i.responseDue=null;
  if(event.status==='cancelled'){i.cancelled=true;state.gaps=state.gaps||[];if(!state.gaps.includes(i.id))state.gaps.push(i.id);state.gap={visitId:i.id}}
  return true;
 }
 function retry(n,now=Date.now()){n.processing='queued';n.error='';n.job={id:'process:'+n.id,stage:n.status==='mock-remote'?'transcribe':'upload',dueAt:now,attempt:(n.job?.attempt||0)+1}}
 function assessCandidate({previousSeconds,nextSeconds,availableMinutes,durationMinutes,bufferMinutes=10,availability='unknown'}){
  if(![previousSeconds,nextSeconds].every(Number.isFinite))return {state:'unknown',reason:'Travel not verified'};
  const required=Math.ceil((previousSeconds+nextSeconds)/60)+durationMinutes+bufferMinutes;
  if(required>availableMinutes)return {state:'infeasible',reason:'Does not fit before the next commitment',requiredMinutes:required};
  if(availability==='declined'||availability==='unavailable')return {state:'unavailable',reason:'Unavailable for this slot',requiredMinutes:required};
  return {state:availability==='confirmed'?'feasible':'tentative',reason:availability==='confirmed'?'Fits the slot · Demo availability confirmed':'Fits travel window · Availability unconfirmed',requiredMinutes:required};
 }
 function trash(state,noteId,now=Date.now()){const n=state.notes.find(x=>x.id===noteId);if(n)n.deletedAt=now}
 function restore(state,noteId){const n=state.notes.find(x=>x.id===noteId);if(n)delete n.deletedAt}
 function erase(state,noteId){const n=state.notes.find(x=>x.id===noteId);if(!n)return [];const assets=[...new Set([...(n.originalAudioIds||[]),...(n.originalFileIds||[])])];state.notes=state.notes.filter(x=>x.id!==noteId);state.tasks=state.tasks.filter(x=>x.note!==noteId);return assets}
 return {clone,id,scopeKey,makeDraft,commit,acceptSuggestion,search,mockTick,retry,assessCandidate,trash,restore,erase,outcomes,requestBooking,applyBookingEvent};
});
