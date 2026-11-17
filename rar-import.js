// RAR import helper. Uses unrar-js in browser when network/WASM support allows.
// Extraction is not repair; encrypted, split, corrupt and very large archives may fail.
const MAX_ARCHIVE=256*1024*1024;
export async function unpackRar(file){
 if(file.size>MAX_ARCHIVE)throw Error('Archivio oltre 256 MiB: troppo grande per questa demo su telefono.');
 const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const v4=[0x52,0x61,0x72,0x21,0x1a,0x07,0x00],v5=[...v4.slice(0,6),0x01,0x00];
 const matches=a=>a.every((x,i)=>head[i]===x);
 if(!matches(v4)&&!matches(v5))throw Error('Firma RAR non valida. Cambiare estensione non ripara un archivio.');
 let lib;
 try{lib=await import('https://esm.sh/unrar-js@0.2.3?bundle');}
 catch(e){throw Error('Motore RAR non disponibile (rete o browser): '+e.message);}
 if(typeof lib.createExtractorFromData!=='function')throw Error('Motore RAR incompatibile con questa versione.');
 const extractor=await lib.createExtractorFromData({data:new Uint8Array(await file.arrayBuffer())});
 const extracted=extractor.extract();
 const files=[];
 let total=0;
 for(const entry of extracted.files){
  if(entry.fileHeader.flags.directory)continue;
  const data=entry.extraction;
  if(!data)continue;
  total+=data.length;
  if(total>512*1024*1024)throw Error('Limite memoria estrazione superato (512 MiB).');
  files.push({name:entry.fileHeader.name,size:data.length,data});
  if(files.length>=300)break;
 }
 return files;
}
