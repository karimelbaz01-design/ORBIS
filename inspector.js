// ORBIS file inspection: format identification only, not game execution.
export async function inspectFile(file) {
  const header = new Uint8Array(await file.slice(0, Math.min(file.size, 4096)).arrayBuffer());
  const starts = (...b) => b.every((v,i) => header[i] === v);
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  const details = [];
  let type = 'Formato sconosciuto', verified = false;
  if (starts(0,0x50,0x53,0x46)) {
    type = 'PSF / PARAM.SFO'; verified = true;
    if (header.length >= 20) {
      const view = new DataView(header.buffer);
      const keyStart = view.getUint32(8,true), dataStart = view.getUint32(12,true), count = Math.min(view.getUint32(16,true),256);
      const decoder = new TextDecoder();
      for (let i=0;i<count;i++) {
        const at=20+i*16;
        if (at+16>header.length) break;
        const keyOffset=view.getUint16(at,true), dataLen=view.getUint32(at+4,true), dataOffset=view.getUint32(at+12,true);
        const keyAt=keyStart+keyOffset, valueAt=dataStart+dataOffset;
        if (keyAt>=header.length || valueAt>=header.length) continue;
        const keyEnd=header.indexOf(0,keyAt);
        if(keyEnd<0) continue;
        const key=decoder.decode(header.slice(keyAt,keyEnd));
        if(['TITLE','TITLE_ID','CATEGORY','APP_VER','PS3_SYSTEM_VER'].includes(key)){
          const value=decoder.decode(header.slice(valueAt,Math.min(valueAt+dataLen,header.length))).replace(/\0.*$/s,'');
          details.push(key+': '+value);
        }
      }
    }
  } else if(starts(0x7f,0x45,0x4c,0x46)){
    type='ELF'; verified=true;
    if(header.length>=20){
      const machine=new DataView(header.buffer).getUint16(18,header[5]===1);
      details.push('Architettura ELF: '+(machine===20?'PowerPC 32-bit (non necessariamente PS3)':machine===21?'PowerPC 64-bit':'machine '+machine));
    }
  } else if(starts(0x7f,0x50,0x4b,0x47)){type='PKG (firma PS3)';verified=true;}
  else if(starts(0x53,0x43,0x45,0x00)){type='SELF/SCE (firma rilevata)';verified=true;}
  else if(starts(0x50,0x4b,0x03,0x04)){type='ZIP';verified=true;}
  else if(extension==='iso'){
    type='ISO (non verificata)';
    // ISO9660 PVD at sector 16, offset 1: CD001, for standard 2048-byte sectors.
    if(file.size>=32774){
      const pvd=new Uint8Array(await file.slice(32768,32774).arrayBuffer());
      if(pvd[0]===1 && [67,68,48,48,49].every((v,i)=>pvd[i+1]===v)){type='ISO9660 (firma verificata)';verified=true;}
    }
    details.push('ISO9660 non implica che sia un disco PS3 valido.');
  } else if(extension==='pkg'){type='PKG (firma non valida o assente)';}
  else if(extension==='pup'){type='PUP (non verificato)';}
  else if(extension==='self'){type='SELF (non verificato)';}
  details.push('Compatibilità con giochi PS3: non verificata');
  return {name:file.name,size:file.size,type,verified,details,header:Array.from(header.slice(0,32)).map(b=>b.toString(16).padStart(2,'0')).join(' ')};
}
