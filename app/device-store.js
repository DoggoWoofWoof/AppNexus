(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldProDeviceStore=api})(globalThis,()=>{
 'use strict';
 function create({indexedDB=globalThis.indexedDB,name='field-pro-local-v1',memoryPreview=false}={}){
  if(memoryPreview)return previewStore();
  let connection;
  const open=()=>connection||(connection=new Promise((resolve,reject)=>{
   if(!indexedDB){reject(new Error('Device storage unavailable. Download your work before leaving.'));return}
   const request=indexedDB.open(name,1);
   request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('workspaces');db.createObjectStore('assets');db.createObjectStore('chunks')};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};
   request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close another demo tab to unlock device storage.'));
  }));
  async function transaction(stores,mode,run){
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,mode);let result,error;
    const set=value=>{result=value};
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||tx.error||new Error('Device save failed'));tx.onerror=()=>{error=tx.error};
    try{run(tx,set)}catch(e){error=e;tx.abort()}
   });
  }
  const key=(scope,id)=>JSON.stringify([scope,id]);
  async function load(scope){return transaction(['workspaces'],'readonly',(tx,set)=>{const r=tx.objectStore('workspaces').get(scope);r.onsuccess=()=>set(r.result||null)})}
  async function save(scope,state){return transaction(['workspaces'],'readwrite',tx=>tx.objectStore('workspaces').put(structuredClone(state),scope))}
  async function createAsset(scope,asset){return transaction(['assets'],'readwrite',tx=>tx.objectStore('assets').add({...asset,scope,nextSequence:0,byteLength:0},key(scope,asset.id)))}
  async function append(scope,id,sequence,bytes){
   if(!bytes.byteLength)return;
   return transaction(['assets','chunks'],'readwrite',tx=>{
    const assets=tx.objectStore('assets'),r=assets.get(key(scope,id));
    r.onsuccess=()=>{const a=r.result;if(!a){tx.abort();return}if(sequence<a.nextSequence)return;if(sequence!==a.nextSequence){tx.abort();return}tx.objectStore('chunks').add(bytes,key(scope,id+':'+sequence));a.nextSequence++;a.byteLength+=bytes.byteLength;a.savedAt=Date.now();assets.put(a,key(scope,id))};
   });
  }
  async function asset(scope,id){return transaction(['assets'],'readonly',(tx,set)=>{const r=tx.objectStore('assets').get(key(scope,id));r.onsuccess=()=>set(r.result||null)})}
  async function finish(scope,id,status='stopped'){return transaction(['assets'],'readwrite',tx=>{const store=tx.objectStore('assets'),r=store.get(key(scope,id));r.onsuccess=()=>{if(r.result)store.put({...r.result,status,stoppedAt:Date.now()},key(scope,id))}})}
  async function bytes(scope,id){
   const metadata=await asset(scope,id);if(!metadata)throw new Error('Audio unavailable in this workspace.');
   const parts=await transaction(['chunks'],'readonly',(tx,set)=>{const list=new Array(metadata.nextSequence);if(!list.length){set(list);return}let count=0;for(let i=0;i<list.length;i++){const r=tx.objectStore('chunks').get(key(scope,id+':'+i));r.onsuccess=()=>{if(!r.result){tx.abort();return}list[i]=r.result;if(++count===list.length)set(list)}}});
   return {metadata,parts};
  }
  async function putFile(scope,id,file){await createAsset(scope,{id,name:file.name||'attachment',mime:file.type||'application/octet-stream',kind:'file',status:'saving'});await append(scope,id,0,await file.arrayBuffer());await finish(scope,id,'ready');return asset(scope,id)}
  async function deleteBundle(scope,state,ids=[]){
   const metadata=await Promise.all(ids.map(id=>asset(scope,id)));
   return transaction(['workspaces','assets','chunks'],'readwrite',tx=>{
    tx.objectStore('workspaces').put(structuredClone(state),scope);
    for(const a of metadata){if(!a)continue;tx.objectStore('assets').delete(key(scope,a.id));for(let i=0;i<a.nextSequence;i++)tx.objectStore('chunks').delete(key(scope,a.id+':'+i))}
   });
  }
  async function clear(scope){
   return transaction(['workspaces','assets','chunks'],'readwrite',tx=>{
    tx.objectStore('workspaces').delete(scope);
    for(const name of ['assets','chunks']){const request=tx.objectStore(name).openCursor();request.onsuccess=()=>{const c=request.result;if(c){if(JSON.parse(c.key)[0]===scope)c.delete();c.continue()}}}
   });
  }
  return {persistent:true,load,save,createAsset,append,asset,finish,bytes,putFile,deleteBundle,clear,close:async()=>{(await open()).close();connection=null}};
 }
 function previewStore(){
  const work=new Map(),assets=new Map(),chunks=new Map(),key=(s,id)=>JSON.stringify([s,id]);
  const api={persistent:false,load:async s=>structuredClone(work.get(s)||null),save:async(s,v)=>{work.set(s,structuredClone(v))},createAsset:async(s,a)=>{assets.set(key(s,a.id),{...a,scope:s,nextSequence:0,byteLength:0})},asset:async(s,id)=>structuredClone(assets.get(key(s,id))||null),append:async(s,id,seq,data)=>{const a=assets.get(key(s,id));if(!a)throw new Error('Attachment unavailable');if(seq<a.nextSequence)return;if(seq!==a.nextSequence)throw new Error('Missing audio portion');chunks.set(key(s,id+':'+seq),data.slice(0));a.nextSequence++;a.byteLength+=data.byteLength},finish:async(s,id,status)=>{const a=assets.get(key(s,id));if(a)a.status=status},bytes:async(s,id)=>{const metadata=await api.asset(s,id);if(!metadata)throw new Error('Attachment unavailable');return {metadata,parts:Array.from({length:metadata.nextSequence},(_,n)=>chunks.get(key(s,id+':'+n)).slice(0))}},putFile:async(s,id,f)=>{await api.createAsset(s,{id,name:f.name,mime:f.type,kind:'file'});await api.append(s,id,0,await f.arrayBuffer());await api.finish(s,id,'ready')},deleteBundle:async(s,state,ids)=>{work.set(s,structuredClone(state));for(const id of ids){const a=assets.get(key(s,id));for(let n=0;n<(a?.nextSequence||0);n++)chunks.delete(key(s,id+':'+n));assets.delete(key(s,id))}},clear:async s=>{work.delete(s);for(const map of [assets,chunks])for(const k of map.keys())if(JSON.parse(k)[0]===s)map.delete(k)},close:async()=>{}};
  return api;
 }
 return {create};
});
