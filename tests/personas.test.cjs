const {test}=require('node:test');
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const M=require('../app/capture-model.js');
const S=require('../app/device-store.js');
const R=require('../app/recording-session.js');
const state=()=>({notes:[],tasks:[],drafts:{},items:[{id:'v1',day:'today',target:'maya'},{id:'v2',day:'tomorrow',target:'maya'},{id:'v3',day:'today',target:'jordan'}],materials:[],scenario:'normal'});
const draft=(s,options={})=>{const d=M.makeDraft({source:'maya',attendees:['maya'],visitId:'v1',...options});s.drafts[d.id]=d;return d};
const store=()=>S.create({indexedDB:new IDBFactory(),name:M.id()});
test('P1 minimum effort: no default outcome, optional note, retry is idempotent',()=>{
 const s=state(),d=draft(s);assert.equal(d.outcome,null);assert.throws(()=>M.commit(s,d.id,null),/actual/);const n=M.commit(s,d.id,'Attempted');M.commit(s,d.id,'Attempted');assert.equal(s.notes.length,1);assert.equal(n.originalText,'');assert.equal(s.items[0].done,true);assert.equal(s.items[1].done,undefined);assert.equal(s.items[2].done,undefined);assert.equal(n.meetingDate,'2026-10-17');assert.equal(M.search(s,'2026-10-17').length,1);
});
test('P2 device persistence: exact draft and committed audio recover in a fresh connection',async()=>{
 const indexedDB=new IDBFactory(),name=M.id(),a=S.create({indexedDB,name}),s=state(),d=draft(s);d.note='Interrupted visit';d.audioIds=['a'];await a.save('rep',s);await a.createAsset('rep',{id:'a',kind:'sample',mime:'audio/wav',status:'recording'});await a.append('rep','a',0,new Int16Array([1,2,3]).buffer);await a.close();const b=S.create({indexedDB,name});assert.equal((await b.load('rep')).drafts[d.id].note,d.note);assert.equal((await b.bytes('rep','a')).parts[0].byteLength,6);assert.equal((await b.asset('rep','a')).status,'recording');await b.close();
});
test('P2 recorder interruption preserves bytes and produces a valid WAV',async()=>{
 const a=store(),r=R.create({store:a});await r.start({scope:'rep',id:'audio',draftId:'d'});await r.drain();r.interrupt();await r.stop();const b=await r.blob('rep','audio'),v=new DataView(await b.arrayBuffer());assert.equal(b.type,'audio/wav');assert.equal(v.getUint32(40,true),b.size-44);assert.ok(b.size>44);r.dispose();await a.close();
});
test('P2 quota failure retains unsaved bytes for download and retries once',async()=>{
 const a=store();let fail=true;const r=R.create({store:{...a,append:(...args)=>fail?Promise.reject(new Error('QuotaExceededError')):a.append(...args)}});await r.start({scope:'rep',id:'a',draftId:'d'});await assert.rejects(r.drain());assert.equal(r.current().status,'save-failed');assert.ok((await r.blob('rep','a')).size>44);fail=false;await r.retry();await r.stop();assert.equal((await a.asset('rep','a')).nextSequence,1);r.dispose();await a.close();
});
test('P3 correct attribution: HCO requires attendees; one group conversation is linked to exact visit',()=>{
 const s=state(),d=draft(s,{source:'riverside',attendees:[]});assert.throws(()=>M.commit(s,d.id,'Met'),/who/);d.attendees=['maya','alex'];M.commit(s,d.id,'Met');assert.equal(s.notes.length,1);assert.deepEqual(s.notes[0].attendees,['maya','alex']);assert.equal(s.items[1].done,undefined);
});
test('P4 replacement safety: road window, unavailable and unknown states remain distinct',()=>{
 const base={previousSeconds:1200,nextSeconds:1200,availableMinutes:60,durationMinutes:30};assert.equal(M.assessCandidate(base).state,'infeasible');assert.equal(M.assessCandidate({...base,availableMinutes:100}).state,'tentative');assert.equal(M.assessCandidate({...base,availableMinutes:100,availability:'confirmed'}).state,'feasible');assert.equal(M.assessCandidate({...base,availableMinutes:100,availability:'unavailable'}).state,'unavailable');assert.equal(M.assessCandidate({...base,nextSeconds:undefined}).state,'unknown');
});
test('P5 background transcript: return immediately, preserve original, review suggestions before tasks',()=>{
 const s=state(),d=draft(s);d.note='Send the report';const n=M.commit(s,d.id,'Met');assert.equal(n.processing,'queued');assert.equal(s.tasks.length,0);M.mockTick(s,Date.now()+1000);M.mockTick(s,Date.now()+2000);M.mockTick(s,Date.now()+3000);assert.equal(n.processing,'ready');assert.equal(n.originalText,'Send the report');n.correctedTranscript='Discuss report first';M.retry(n);M.mockTick(s,Date.now()+4000);M.mockTick(s,Date.now()+5000);assert.match(n.summary,/Discuss report/);assert.equal(n.transcriptOriginal,'Send the report');assert.throws(()=>M.acceptSuggestion(s,n.id,'send-report',''),/due/);M.acceptSuggestion(s,n.id,'send-report','2026-10-18');M.acceptSuggestion(s,n.id,'send-report','2026-10-18');assert.equal(s.tasks.length,1);
});
test('P5 reports: failure and successful fixture generation are explicit',()=>{
 const s=state();s.materials=[{id:'m',target:'maya',name:'Procedure report',status:'generating',dueAt:1}];s.scenario='report-fails';M.mockTick(s,10);assert.equal(s.materials[0].status,'failed');s.scenario='normal';s.materials[0].status='generating';M.mockTick(s,20);assert.equal(s.materials[0].status,'ready');assert.match(s.materials[0].content,/DEMO/);
});
test('P6 multilingual imported text survives correction, search and processing retry',()=>{
 const s=state(),d=draft(s,{language:'Hindi'});d.note='अगली बैठक सोमवार को';const n=M.commit(s,d.id,'Met');s.scenario='transcription-fails';M.mockTick(s,Date.now()+1000);M.mockTick(s,Date.now()+2000);assert.equal(n.processing,'failed');assert.equal(n.originalText,d.note);s.scenario='normal';M.retry(n);M.mockTick(s,Date.now()+3000);M.mockTick(s,Date.now()+4000);n.correctedTranscript='Monday meeting';assert.equal(M.search(s,'सोमवार').length,1);assert.equal(M.search(s,'Monday').length,1);
});
test('P7 booking events: exact request, duplicates and stale responses never overwrite cancellation',()=>{
 const s=state(),i=s.items[0],requestId=M.requestBooking(i,1);const accepted={visitId:i.id,requestId,id:'e1',version:1,status:'confirmed'};assert.equal(M.applyBookingEvent(s,{...accepted,requestId:'other'}),false);assert.equal(M.applyBookingEvent(s,accepted),true);assert.equal(M.applyBookingEvent(s,accepted),false);M.applyBookingEvent(s,{...accepted,id:'e2',version:2,status:'cancelled'});assert.equal(M.applyBookingEvent(s,{...accepted,id:'late'}),false);assert.equal(i.cancelled,true);assert.deepEqual(s.gaps,['v1']);assert.equal(s.items[2].cancelled,undefined);const replacementRequest=M.requestBooking(i,100);assert.equal(M.applyBookingEvent(s,accepted),false);assert.notEqual(requestId,replacementRequest);
});
test('P7 mock booking declined and offline queue behavior',()=>{
 const s=state(),i=s.items[0];M.requestBooking(i,1);s.scenario='offline';assert.equal(M.mockTick(s,9999),false);assert.equal(i.bookingStatus,'requested');s.scenario='booking-declined';M.mockTick(s,9999);assert.equal(i.bookingStatus,'declined');assert.equal(i.confirmed,false);
});
test('P8 separate drafts and edits do not complete another day or duplicate tasks',()=>{
 const s=state(),a=draft(s),b=draft(s,{visitId:'v2',day:'tomorrow'});a.note='Today';b.note='Tomorrow';a.follow='Send brief';M.commit(s,a.id,'Met');assert.equal(s.drafts[b.id].note,'Tomorrow');const edit=draft(s);edit.editingNote=a.id;edit.note='Corrected today';edit.follow='Updated promise';M.commit(s,edit.id,'Rescheduled');assert.equal(s.notes.length,1);assert.equal(s.notes[0].originalText,'Today');assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].text,'Updated promise');assert.equal(s.items[0].done,false);assert.equal(s.items[1].done,undefined);
});
test('P9 long text and names remain data, including HTML-looking original input',()=>{
 const s=state(),d=draft(s);d.note='<img src=x onerror=alert(1)> '+ 'long conversation '.repeat(10000);const n=M.commit(s,d.id,'Met');assert.equal(n.originalText,d.note);assert.equal(M.search(s,'onerror').length,1);
});
test('P10 scoped media deletion is atomic; other rep and trash restore stay intact',async()=>{
 const a=store(),s=state(),d=draft(s);d.audioIds=['audio'];d.mediaIds=['audio'];const n=M.commit(s,d.id,'Met');for(const scope of ['rep1','rep2']){await a.createAsset(scope,{id:'audio',kind:'file',mime:'audio/wav'});await a.append(scope,'audio',0,new Uint8Array([1,2]).buffer)}M.trash(s,n.id,10);assert.equal(M.search(s).length,0);assert.equal(M.search(s,'','trash').length,1);M.restore(s,n.id);assert.equal(M.search(s).length,1);const ids=M.erase(s,n.id);await a.deleteBundle('rep1',s,ids);assert.equal(await a.asset('rep1','audio'),null);assert.equal((await a.bytes('rep2','audio')).parts.length,1);await a.clear('rep1');assert.ok(await a.asset('rep2','audio'));await a.close();
});
test('Storage ordering: duplicate chunk retries do not duplicate bytes; gaps abort',async()=>{
 const a=store();await a.createAsset('rep',{id:'a'});await a.append('rep','a',0,new Uint8Array([1]).buffer);await a.append('rep','a',0,new Uint8Array([1]).buffer);await assert.rejects(a.append('rep','a',2,new Uint8Array([2]).buffer));assert.equal((await a.asset('rep','a')).byteLength,1);await a.close();
});
test('Microphone permission failure keeps typed fallback available',async()=>{
 const a=store(),r=R.create({store:a});await assert.rejects(r.start({scope:'r',id:'a',draftId:'d',kind:'microphone',deny:true}),/permission denied/);const s=state(),d=draft(s);d.note='Typed fallback';M.commit(s,d.id,'Met');assert.equal(s.notes[0].text,'Typed fallback');await a.close();
});
test('Rescheduling an outcome invalidates the previous office request and confirmation',()=>{
 const s=state(),i=s.items[0];M.requestBooking(i);i.confirmed=true;const d=draft(s);M.commit(s,d.id,'Rescheduled');assert.equal(i.confirmed,false);assert.equal(i.bookingStatus,'reschedule-needed');assert.equal(i.requestId,undefined);assert.equal(i.done,false);
});
test('Embedded opaque-origin preview uses an explicitly non-durable store only when opted in',async()=>{
 const a=S.create({memoryPreview:true});assert.equal(a.persistent,false);await a.save('rep',{notes:['preview']});assert.deepEqual(await a.load('rep'),{notes:['preview']});assert.equal(S.create({indexedDB:new IDBFactory()}).persistent,true);await assert.rejects(S.create({indexedDB:null}).save('rep',{}),/unavailable/);
});
test('Delayed audio conversions retain sequence and Stop waits for the last received portion',async()=>{
 const a=store(),r=R.create({store:a});await r.start({scope:'rep',id:'a',draftId:'d'});await r.drain();let first,second;
 const p1=r.write({size:2,arrayBuffer:()=>new Promise(resolve=>first=resolve)}),p2=r.write({size:2,arrayBuffer:()=>new Promise(resolve=>second=resolve)});
 let stopped=false;const done=r.stop().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);second(new Uint8Array([3,4]).buffer);first(new Uint8Array([1,2]).buffer);await Promise.all([p1,p2,done]);const {parts}=await a.bytes('rep','a');assert.equal(parts.length,3);assert.deepEqual([...new Uint8Array(parts[1])],[1,2]);assert.deepEqual([...new Uint8Array(parts[2])],[3,4]);r.dispose();await a.close();
});
