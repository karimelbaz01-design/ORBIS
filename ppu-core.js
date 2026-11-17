// ORBIS PPU research core: tiny PowerPC instruction interpreter.
// Not RPCS3, not a PS3 system emulator; no syscalls, SPU, RSX, firmware or game support.
const sx16=x=>(x<<16)>>16;
export function runPpuDemo(limit=100) {
 const regs=new Uint32Array(32);let pc=0,steps=0;
 // addi r3,r0,7; addi r4,r0,5; add r5,r3,r4; ori r6,r5,0; blr
 const program=new Uint32Array([0x38600007,0x38800005,0x7ca32214,0x60a60000,0x4e800020]);
 const trace=[];
 while(steps<limit){
  if(pc%4!==0||pc/4>=program.length)throw Error('PC fuori dal programma');
  const word=program[pc>>>2]>>>0,op=word>>>26,rt=(word>>>21)&31,ra=(word>>>16)&31;
  trace.push('PC '+pc.toString(16).padStart(4,'0')+' : '+word.toString(16).padStart(8,'0'));
  steps++;
  if(word===0x4e800020)break; // blr ends our demo (no LR/branch state)
  if(op===14)regs[rt]=((ra===0?0:regs[ra])+sx16(word&65535))>>>0;
  else if(op===24)regs[ra]=(regs[rt]|(word&65535))>>>0;
  else if(op===31 && ((word>>>1)&1023)===266){
   const rb=(word>>>11)&31;regs[rt]=(regs[ra]+regs[rb])>>>0;
  } else throw Error('Istruzione non supportata: 0x'+word.toString(16));
  pc+=4;
 }
 return {steps,registers:{r3:regs[3],r4:regs[4],r5:regs[5],r6:regs[6]},trace,stopped:steps<limit};
}
