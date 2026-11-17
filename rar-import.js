// RAR import helper. Uses unrar-js in browser when network/WASM support allows.
// Extraction is not repair; encrypted, split, corrupt and very large archives may fail.
export async function unpackRar(file){
 const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const v4=[0x52,0x61,0x72,0x21,0x1a,0x07,0x00],v5=[...v4.slice(0,6),0x01,0x00];
 const matches=a=>a.every((x,i)=>head[i]===x);
 if(!matches(v4)&&!matches(v5))throw Error('Firma RAR non valida. Cambiare estensione non ripara un archivio.');
 let lib;
 const sources=['https://cdn.jsdelivr.net/npm/unrar-js@0.2.3/+esm','https://esm.sh/unrar-js@0.2.3?bundle'];
 const failures=[];
 for(const source of sources){try{lib=await import(source);if(typeof lib.createExtractorFromData==='function')break;failures.push('API non disponibile');}catch(e){failures.push(e.message);}}
 if(!lib||typeof lib.createExtractorFromData!=='function')throw Error('Motore RAR non avviato su Safari: '+failures.join(' | '));
 if(typeof lib.createExtractorFromData!=='function')throw Error('Motore RAR incompatibile con questa versione.');
 let extractor;
 try{extractor=await lib.createExtractorFromData({data:new Uint8Array(await file.arrayBuffer())});}
 catch(e){throw Error('Decodifica RAR fallita (possibile limite RAM o incompatibilità del motore): '+e.message);}
 const extracted=extractor.extract();
 const files=[];
 let total=0;
 for(const entry of extracted.files){
  if(entry.fileHeader.flags.directory)continue;
  const data=entry.extraction;
  if(!data)continue;
  total+=data.length;
   files.push({name:entry.fileHeader.name,size:data.length,data});
 }
 return files;
}
