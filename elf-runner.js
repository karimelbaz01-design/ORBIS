// ORBIS ELF32/PowerPC research runner. Not a PS3 emulator.
// Executes only a small safe instruction subset; no PS3 syscalls, SPU, RSX, SELF or PKG support.
const MAX_FILE=8*1024*1024,MAX_MEMORY=4*1024*1024,MAX_STEPS=20000;
const sign16=x=>(x<<16)>>16;
export function parsePpcElf(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(b.length<52||b[0]!==127||b[1]!==69||b[2]!==76||b[3]!==70)throw Error('Non è un ELF');
 if(b[4]!==1||b[5]!==2)throw Error('Supportati soltanto ELF32 big-endian');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(v.getUint16(18,false)!==20)throw Error('Architettura non supportata: richiesto PowerPC 32-bit (EM_PPC=20)');
 const entry=v.getUint32(24,false),phoff=v.getUint32(28,false),phentsize=v.getUint16(42,false),phnum=v.getUint16(44,false);
 if(phentsize<32||phnum===0||phnum>64||phoff+phentsize*phnum>b.length)throw Error('Tabella segmenti ELF non valida');
 const segments=[];
 for(let i=0;i<phnum;i++){
  const at=phoff+i*phentsize;
  if(v.getUint32(at,false)!==1)continue;
  const offset=v.getUint32(at+4,false),address=v.getUint32(at+8,false),fileSize=v.getUint32(at+16,false),memSize=v.getUint32(at+20,false);
  if(memSize<fileSize||memSize>MAX_MEMORY||offset+fileSize>b.length||address+memSize>0x100000000)throw Error('Segmento ELF non valido');
  segments.push({offset,address,fileSize,memSize});
 }
 if(!segments.length)throw Error('Nessun segmento caricabile');
 const base=Math.min(...segments.map(s=>s.address)),end=Math.max(...segments.map(s=>s.address+s.memSize));
 if(end-base>MAX_MEMORY||entry<base||entry>=end)throw Error('Mappa memoria o entry point non supportati');
 return {entry,base,end,segments,bytes:b};
}
export function executePpcElf(elf,limit=1000){
 const parsed=parsePpcElf(elf);
 const memory=new Uint8Array(parsed.end-parsed.base);
 for(const s of parsed.segments)memory.set(parsed.bytes.subarray(s.offset,s.offset+s.fileSize),s.address-parsed.base);
 const view=new DataView(memory.buffer),r=new Uint32Array(32),trace=[];
 let pc=parsed.entry,steps=0,reason='Limite istruzioni raggiunto';
 const max=Math.max(1,Math.min(MAX_STEPS,Math.trunc(limit)||1000));
 while(steps<max){
  const addr=pc-parsed.base;
  if(pc%4||addr<0||addr+4>memory.length){reason='PC fuori memoria';break;}
  const word=view.getUint32(addr,false),op=word>>>26,rt=(word>>>21)&31,ra=(word>>>16)&31,rb=(word>>>11)&31;
  if(trace.length<40)trace.push('0x'+pc.toString(16)+': '+word.toString(16).padStart(8,'0'));
  steps++;
  if(word===0x4e800020){reason='blr (fine demo)';break;}
  if(op===14)r[rt]=((ra===0?0:r[ra])+sign16(word&65535))>>>0;
  else if(op===15)r[rt]=((ra===0?0:r[ra])+(sign16(word&65535)*65536))>>>0;
  else if(op===24)r[ra]=(r[rt]|(word&65535))>>>0;
  else if(op===25)r[ra]=(r[rt]|((word&65535)<<16))>>>0;
  else if(op===31&&((word>>>1)&1023)===266)r[rt]=(r[ra]+r[rb])>>>0;
  else {reason='Istruzione non implementata: 0x'+word.toString(16);break;}
  pc+=4;
 }
 return {steps,reason,registers:{r3:r[3],r4:r[4],r5:r[5],r6:r[6]},trace,entry:parsed.entry,segments:parsed.segments.length};
}
export async function runElfFile(file,limit=1000){
 if(file.size>MAX_FILE)throw Error('Per sicurezza la demo accetta ELF fino a 8 MiB');
 return executePpcElf(new Uint8Array(await file.arrayBuffer()),limit);
}
