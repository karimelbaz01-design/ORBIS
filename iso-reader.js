// ORBIS ISO9660 directory inspector. Reads bounded slices of a local File.
// Not a PS3 disc mounter, decryptor, or emulator.
const SECTOR=2048,MAX_DIR=2*1024*1024;
const u32=(b,i)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(i,true);
const ascii=b=>new TextDecoder('ascii').decode(b).replace(/\0/g,'').trim();
async function read(file,start,length){
 if(!Number.isSafeInteger(start)||start<0||length<0||start+length>file.size)throw Error('Lettura fuori dai limiti ISO');
 return new Uint8Array(await file.slice(start,start+length).arrayBuffer());
}
function record(b,at){
 const len=b[at];if(!len||at+len>b.length||len<34)return null;
 const n=b[at+32],raw=b.subarray(at+33,at+33+n);
 if(at+33+n>at+len)return null;
 const name=n===1&&raw[0]===0?'.':n===1&&raw[0]===1?'..':ascii(raw).replace(/;[0-9]+$/,'');
 return {name,sector:u32(b,at+2),size:u32(b,at+10),directory:!!(b[at+25]&2)};
}
async function list(file,dir){
 if(dir.size>MAX_DIR)throw Error('Cartella ISO troppo grande per questa demo');
 const bytes=await read(file,dir.sector*SECTOR,dir.size),items=[];
 for(let p=0;p<bytes.length;){
  if(!bytes[p]){p=(Math.floor(p/SECTOR)+1)*SECTOR;continue;}
  const entry=record(bytes,p);if(!entry)break;
  if(entry.name!=='.'&&entry.name!=='..')items.push(entry);
  p+=bytes[p];if(items.length>2000)break;
 }
 return items;
}
function parseSfo(bytes){
 if(bytes.length<20||bytes[0]!==0||bytes[1]!==80||bytes[2]!==83||bytes[3]!==70)return {};
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const keys=v.getUint32(8,true),data=v.getUint32(12,true),count=Math.min(v.getUint32(16,true),256);
 const out={};const dec=new TextDecoder();
 for(let i=0;i<count;i++){
  const p=20+i*16;if(p+16>bytes.length)break;
  const ko=v.getUint16(p,true),size=v.getUint32(p+4,true),offset=v.getUint32(p+12,true);
  if(keys+ko>=bytes.length||data+offset>=bytes.length)continue;
  let end=bytes.indexOf(0,keys+ko);if(end<0)continue;
  const key=dec.decode(bytes.slice(keys+ko,end));
  if(['TITLE','TITLE_ID','CATEGORY','APP_VER','PS3_SYSTEM_VER'].includes(key))
   out[key]=dec.decode(bytes.slice(data+offset,Math.min(data+offset+size,bytes.length))).split('\0')[0];
 }
 return out;
}
export async function inspectIso(file){
 const pvd=await read(file,16*SECTOR,SECTOR);
 if(pvd[0]!==1||ascii(pvd.slice(1,6))!=='CD001')throw Error('ISO9660 standard non riconosciuto: potrebbe essere una ISO PS3 con formato diverso o criptata');
 const root=record(pvd,156);if(!root||!root.directory)throw Error('Directory principale ISO non valida');
 const rootEntries=await list(file,root);
 const game=rootEntries.find(e=>e.directory&&e.name.toUpperCase()==='PS3_GAME');
 const result={volume:ascii(pvd.slice(40,72)),root:rootEntries.slice(0,35).map(e=>e.name),ps3Game:!!game,eboot:false,metadata:{},note:''};
 if(!game){result.note='Cartella PS3_GAME non individuata nella directory ISO9660.';return result;}
 const entries=await list(file,game);
 const sfo=entries.find(e=>!e.directory&&e.name.toUpperCase()==='PARAM.SFO');
 const usrdir=entries.find(e=>e.directory&&e.name.toUpperCase()==='USRDIR');
 if(sfo&&sfo.size<=1024*1024)result.metadata=parseSfo(await read(file,sfo.sector*SECTOR,sfo.size));
 if(usrdir){const contents=await list(file,usrdir);result.eboot=contents.some(e=>e.name.toUpperCase()==='EBOOT.BIN');}
 result.note='Struttura PS3 individuata; non dimostra che il gioco sia eseguibile o compatibile.';
 return result;
}
