(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldProRecording=api})(globalThis,()=>{
 'use strict';
 function wav(parts){
  const length=parts.reduce((sum,b)=>sum+b.byteLength,0),buffer=new ArrayBuffer(44+length),v=new DataView(buffer);
  const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,36+length,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length,true);let offset=44;for(const p of parts){new Uint8Array(buffer,offset,p.byteLength).set(new Uint8Array(p));offset+=p.byteLength}return new Blob([buffer],{type:'audio/wav'});
 }
 function create({store,mediaDevices=globalThis.navigator?.mediaDevices,MediaRecorder=globalThis.MediaRecorder,onChange=()=>{}}){
  let session=null,queue=Promise.resolve(),timer,recorder,stream,pending=[],conversions=new Set();
  const notify=()=>onChange(session?{...session}:null);
  function write(data){
   const s=session;if(!s)return;
   if(data.byteLength===0||data.size===0)return Promise.resolve();
   const part={sequence:s.nextSequence++,bytes:null};pending.push(part);
   const ready=Promise.resolve(data instanceof ArrayBuffer?data:data.arrayBuffer()).then(bytes=>part.bytes=bytes);conversions.add(ready);ready.then(()=>conversions.delete(ready),()=>conversions.delete(ready));
   queue=queue.then(async()=>{await ready;await store.append(s.scope,s.id,part.sequence,part.bytes)}).then(()=>{pending=pending.filter(p=>p!==part);s.bytes+=part.bytes.byteLength;s.savedAt=Date.now();s.error='';notify()}).catch(error=>{clearInterval(timer);s.error=error.message;s.status='save-failed';try{if(recorder?.state==='recording')recorder.stop()}catch{}notify();throw error});
   queue.catch(()=>{});return queue;
  }
  async function start({scope,id,draftId,kind='sample',deny=false}){
   if(session&&['recording','interrupted','save-failed'].includes(session.status))throw new Error('Stop the current recording before starting another.');
   if(deny)throw new Error('Microphone permission denied. You can type a note instead.');
   session={scope,id,draftId,kind,status:'starting',nextSequence:0,bytes:0,savedAt:null,error:'',startedAt:Date.now()};queue=Promise.resolve();pending=[];notify();
   try{
    let mime='audio/wav';
    if(kind==='microphone'){
     if(!mediaDevices?.getUserMedia||!MediaRecorder)throw new Error('Recording is unavailable here. Use a note or add a file.');
     stream=await mediaDevices.getUserMedia({audio:true});
     mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
     recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});mime=recorder.mimeType||mime||'audio/webm';
    }
    await store.createAsset(scope,{id,draftId,kind,mime,name:kind==='sample'?'Demo sample tone':'Voice recording',status:'recording',startedAt:Date.now()});
    session.status='recording';
    if(kind==='sample'){
     const chunk=()=>{const pcm=new Int16Array(4000);for(let i=0;i<pcm.length;i++)pcm[i]=Math.sin(i*2*Math.PI*220/8000)*1200;void write(pcm.buffer).catch(()=>{})};chunk();timer=setInterval(chunk,500);
    }else{
     recorder.ondataavailable=e=>{if(e.data.size)void write(e.data).catch(()=>{})};
     recorder.onerror=()=>interrupt('The microphone stopped unexpectedly. Captured chunks remain available.');
     for(const track of stream.getTracks()){track.onmute=()=>interrupt('Microphone interrupted. Captured chunks are saved when received.');track.onended=()=>interrupt('Microphone ended. Recover the saved portion.')}
     recorder.start(1000);
    }
    notify();return {...session};
   }catch(error){session.status='failed';session.error=error.message;stream?.getTracks().forEach(t=>t.stop());notify();throw error}
  }
  function interrupt(message='Recording interrupted. Recover the saved portion.'){
   if(!session||session.status==='interrupted'||session.status==='stopped')return;clearInterval(timer);session.status='interrupted';session.error=message;try{if(recorder?.state==='recording'){recorder.requestData();recorder.stop()}}catch{}stream?.getTracks().forEach(t=>t.stop());notify();
  }
  async function stop(){
   if(!session)throw new Error('No recording to stop.');clearInterval(timer);
   if(recorder&&recorder.state!=='inactive')await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop()});
   stream?.getTracks().forEach(t=>t.stop());await queue;
   if(session.error&&session.status==='save-failed')throw new Error(session.error);
   await store.finish(session.scope,session.id,session.status==='interrupted'?'interrupted':'stopped');session.status='stopped';notify();return {...session};
  }
  async function retry(){clearInterval(timer);try{if(recorder?.state==='recording')await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop()})}catch{}await Promise.all([...conversions]);await queue.catch(()=>{});queue=Promise.resolve();for(const part of [...pending].sort((a,b)=>a.sequence-b.sequence)){await store.append(session.scope,session.id,part.sequence,part.bytes);session.bytes+=part.bytes.byteLength;pending=pending.filter(p=>p.sequence!==part.sequence)}session.error='';session.savedAt=Date.now();session.status='interrupted';notify()}
  async function blob(scope,id){const {metadata,parts}=await store.bytes(scope,id);if(session?.id===id&&session.scope===scope){await Promise.all([...conversions]);parts.push(...pending.sort((a,b)=>a.sequence-b.sequence).map(p=>p.bytes))}if(!parts.reduce((s,p)=>s+p.byteLength,0))throw new Error('No audio was captured.');return metadata.kind==='sample'?wav(parts):new Blob(parts,{type:metadata.mime})}
  return {start,stop,interrupt,write,blob,retry,current:()=>session?{...session}:null,drain:()=>queue,dispose:()=>{clearInterval(timer);try{recorder?.stop()}catch{}stream?.getTracks().forEach(t=>t.stop());session=null;pending=[]}};
 }
 return {create,wav};
});
