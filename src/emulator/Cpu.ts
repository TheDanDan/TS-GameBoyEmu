import { FLAG } from './constants';
import type { Bus } from './Bus';

export interface CpuRegisters { a: number; f: number; b: number; c: number; d: number; e: number; h: number; l: number; sp: number; pc: number; }
const VECTORS = [0x40, 0x48, 0x50, 0x58, 0x60];
const REGISTERS = ['b', 'c', 'd', 'e', 'h', 'l', '', 'a'] as const;

/** LR35902 processor. Instruction timings are returned in T-cycles. */
export class Cpu {
  public readonly registers: CpuRegisters = { a: 1, f: 0xb0, b: 0, c: 0x13, d: 0, e: 0xd8, h: 1, l: 0x4d, sp: 0xfffe, pc: 0x100 };
  private ime = false;
  private imeDelay = 0;
  private halted = false;
  private stopped = false;
  public reset(): void { Object.assign(this.registers, { a: 1, f: 0xb0, b: 0, c: 0x13, d: 0, e: 0xd8, h: 1, l: 0x4d, sp: 0xfffe, pc: 0x100 }); this.ime = false; this.imeDelay = 0; this.halted = false; this.stopped = false; }
  public get af(): number { return (this.registers.a << 8) | this.registers.f; }
  public get bc(): number { return (this.registers.b << 8) | this.registers.c; }
  public get de(): number { return (this.registers.d << 8) | this.registers.e; }
  public get hl(): number { return (this.registers.h << 8) | this.registers.l; }
  public getFlag(flag: number): boolean { return (this.registers.f & flag) !== 0; }

  public step(bus: Bus): number {
    const pending = bus.read8(0xffff) & bus.read8(0xff0f) & 0x1f;
    if (pending) { this.halted = false; this.stopped = false; }
    if (this.ime && pending) {
      const bit = Math.log2(pending & -pending); bus.write8(0xff0f, bus.read8(0xff0f) & ~(1 << bit)); this.ime = false;
      this.push(bus, this.registers.pc); this.registers.pc = VECTORS[bit]!; return 20;
    }
    if (this.halted || this.stopped) return 4;
    const opcode = this.fetch8(bus);
    let cycles: number;
    if (opcode >= 0x40 && opcode <= 0x7f) {
      if (opcode === 0x76) { this.halted = true; cycles = 4; }
      else { this.writeR((opcode >>> 3) & 7, this.readR(opcode & 7, bus), bus); cycles = ((opcode & 7) === 6 || ((opcode >>> 3) & 7) === 6) ? 8 : 4; }
    } else if (opcode >= 0x80 && opcode <= 0xbf) { this.alu((opcode >>> 3) & 7, this.readR(opcode & 7, bus)); cycles = (opcode & 7) === 6 ? 8 : 4; }
    else if ((opcode & 0xc7) === 0x04) { const r=(opcode>>>3)&7;const v=this.readR(r,bus);const n=(v+1)&255;this.writeR(r,n,bus);this.registers.f=(this.registers.f&FLAG.CARRY)|(n===0?FLAG.ZERO:0)|((v&15)===15?FLAG.HALF_CARRY:0);cycles=r===6?12:4; }
    else if ((opcode & 0xc7) === 0x05) { const r=(opcode>>>3)&7;const v=this.readR(r,bus);const n=(v-1)&255;this.writeR(r,n,bus);this.registers.f=(this.registers.f&FLAG.CARRY)|FLAG.SUBTRACT|(n===0?FLAG.ZERO:0)|((v&15)===0?FLAG.HALF_CARRY:0);cycles=r===6?12:4; }
    else if ((opcode & 0xc7) === 0x06) { const r=(opcode>>>3)&7;this.writeR(r,this.fetch8(bus),bus);cycles=r===6?12:8; }
    else if ((opcode & 0xcf) === 0x01) { this.setPair((opcode>>>4)&3,this.fetch16(bus));cycles=12; }
    else if ((opcode & 0xcf) === 0x03) { const p=(opcode>>>4)&3;this.setPair(p,this.getPair(p)+1);cycles=8; }
    else if ((opcode & 0xcf) === 0x0b) { const p=(opcode>>>4)&3;this.setPair(p,this.getPair(p)-1);cycles=8; }
    else if ((opcode & 0xcf) === 0x09) { const value=this.getPair((opcode>>>4)&3);const hl=this.hl;const sum=hl+value;this.setHL(sum);this.registers.f=(this.registers.f&FLAG.ZERO)|(((hl&0xfff)+(value&0xfff)>0xfff)?FLAG.HALF_CARRY:0)|(sum>0xffff?FLAG.CARRY:0);cycles=8; }
    else if ((opcode & 0xc7) === 0xc7) { this.push(bus,this.registers.pc);this.registers.pc=opcode&0x38;cycles=16; }
    else cycles = this.execute(opcode, bus);
    if (this.imeDelay > 0 && --this.imeDelay === 0) this.ime = true;
    this.registers.f &= 0xf0;
    return cycles;
  }

  private execute(op: number, bus: Bus): number {
    const r=this.registers; const condition=(n:number)=>n===0?!this.getFlag(FLAG.ZERO):n===1?this.getFlag(FLAG.ZERO):n===2?!this.getFlag(FLAG.CARRY):this.getFlag(FLAG.CARRY);
    switch(op){
      case 0x00:return 4; case 0x02:bus.write8(this.bc,r.a);return 8;case 0x12:bus.write8(this.de,r.a);return 8;case 0x0a:r.a=bus.read8(this.bc);return 8;case 0x1a:r.a=bus.read8(this.de);return 8;
      case 0x07:{const c=r.a>>>7;r.a=((r.a<<1)|c)&255;r.f=c?FLAG.CARRY:0;return 4;}case 0x0f:{const c=r.a&1;r.a=(r.a>>>1)|(c<<7);r.f=c?FLAG.CARRY:0;return 4;}case 0x17:{const c=r.a>>>7;r.a=((r.a<<1)|(this.getFlag(FLAG.CARRY)?1:0))&255;r.f=c?FLAG.CARRY:0;return 4;}case 0x1f:{const c=r.a&1;r.a=(r.a>>>1)|(this.getFlag(FLAG.CARRY)?0x80:0);r.f=c?FLAG.CARRY:0;return 4;}
      case 0x08:{const a=this.fetch16(bus);bus.write16(a,r.sp);return 20;}case 0x10:this.fetch8(bus);this.stopped=true;return 4;
      case 0x18:return this.relative(bus,true);case 0x20:return this.relative(bus,condition(0));case 0x28:return this.relative(bus,condition(1));case 0x30:return this.relative(bus,condition(2));case 0x38:return this.relative(bus,condition(3));
      case 0x22:bus.write8(this.hl,r.a);this.setHL(this.hl+1);return 8;case 0x2a:r.a=bus.read8(this.hl);this.setHL(this.hl+1);return 8;case 0x32:bus.write8(this.hl,r.a);this.setHL(this.hl-1);return 8;case 0x3a:r.a=bus.read8(this.hl);this.setHL(this.hl-1);return 8;
      case 0x27:this.daa();return 4;case 0x2f:r.a^=255;r.f=(r.f&(FLAG.ZERO|FLAG.CARRY))|FLAG.SUBTRACT|FLAG.HALF_CARRY;return 4;case 0x37:r.f=(r.f&FLAG.ZERO)|FLAG.CARRY;return 4;case 0x3f:r.f=(r.f&FLAG.ZERO)|(this.getFlag(FLAG.CARRY)?0:FLAG.CARRY);return 4;
      case 0xc0:return this.ret(bus,condition(0));case 0xc8:return this.ret(bus,condition(1));case 0xd0:return this.ret(bus,condition(2));case 0xd8:return this.ret(bus,condition(3));case 0xc9:r.pc=this.pop(bus);return 16;case 0xd9:r.pc=this.pop(bus);this.ime=true;this.imeDelay=0;return 16;
      case 0xc1:this.setPair(0,this.pop(bus));return 12;case 0xd1:this.setPair(1,this.pop(bus));return 12;case 0xe1:this.setHL(this.pop(bus));return 12;case 0xf1:{const v=this.pop(bus);r.a=v>>>8;r.f=v&0xf0;return 12;}
      case 0xc5:this.push(bus,this.getPair(0));return 16;case 0xd5:this.push(bus,this.getPair(1));return 16;case 0xe5:this.push(bus,this.hl);return 16;case 0xf5:this.push(bus,this.af&0xfff0);return 16;
      case 0xc2:return this.jump(bus,condition(0));case 0xca:return this.jump(bus,condition(1));case 0xd2:return this.jump(bus,condition(2));case 0xda:return this.jump(bus,condition(3));case 0xc3:r.pc=this.fetch16(bus);return 16;case 0xe9:r.pc=this.hl;return 4;
      case 0xc4:return this.call(bus,condition(0));case 0xcc:return this.call(bus,condition(1));case 0xd4:return this.call(bus,condition(2));case 0xdc:return this.call(bus,condition(3));case 0xcd:return this.call(bus,true);
      case 0xc6:this.alu(0,this.fetch8(bus));return 8;case 0xce:this.alu(1,this.fetch8(bus));return 8;case 0xd6:this.alu(2,this.fetch8(bus));return 8;case 0xde:this.alu(3,this.fetch8(bus));return 8;case 0xe6:this.alu(4,this.fetch8(bus));return 8;case 0xee:this.alu(5,this.fetch8(bus));return 8;case 0xf6:this.alu(6,this.fetch8(bus));return 8;case 0xfe:this.alu(7,this.fetch8(bus));return 8;
      case 0xe0:bus.write8(0xff00|this.fetch8(bus),r.a);return 12;case 0xf0:r.a=bus.read8(0xff00|this.fetch8(bus));return 12;case 0xe2:bus.write8(0xff00|r.c,r.a);return 8;case 0xf2:r.a=bus.read8(0xff00|r.c);return 8;case 0xea:bus.write8(this.fetch16(bus),r.a);return 16;case 0xfa:r.a=bus.read8(this.fetch16(bus));return 16;
      case 0xe8:{const e=this.fetch8(bus);const s=e<128?e:e-256;const sp=r.sp;const u=e;const out=(sp+s)&0xffff;r.f=((sp&15)+(u&15)>15?FLAG.HALF_CARRY:0)|((sp&255)+(u&255)>255?FLAG.CARRY:0);r.sp=out;return 16;}
      case 0xf8:{const e=this.fetch8(bus);const s=e<128?e:e-256;const sp=r.sp;const u=e;this.setHL((sp+s)&0xffff);r.f=((sp&15)+(u&15)>15?FLAG.HALF_CARRY:0)|((sp&255)+(u&255)>255?FLAG.CARRY:0);return 12;}case 0xf9:r.sp=this.hl;return 8;
      case 0xf3:this.ime=false;this.imeDelay=0;return 4;case 0xfb:this.imeDelay=2;return 4;
      case 0xcb:return this.cb(this.fetch8(bus),bus);
      default:throw new Error(`Invalid LR35902 opcode 0x${op.toString(16).padStart(2,'0')} at 0x${((r.pc-1)&0xffff).toString(16).padStart(4,'0')}.`);
    }
  }
  private cb(op:number,bus:Bus):number { const r=(op&7),group=op>>>6,bit=(op>>>3)&7;let v=this.readR(r,bus);if(group===1){this.registers.f=(this.registers.f&FLAG.CARRY)|FLAG.HALF_CARRY|((v&(1<<bit))===0?FLAG.ZERO:0);return r===6?12:8;}if(group===2)v&=~(1<<bit);else if(group===3)v|=1<<bit;else{let c=0;switch(bit){case 0:c=v>>>7;v=((v<<1)|c)&255;break;case 1:c=v&1;v=(v>>>1)|(c<<7);break;case 2:c=v>>>7;v=((v<<1)|(this.getFlag(FLAG.CARRY)?1:0))&255;break;case 3:c=v&1;v=(v>>>1)|(this.getFlag(FLAG.CARRY)?0x80:0);break;case 4:c=v>>>7;v=(v<<1)&255;break;case 5:c=v&1;v=(v>>>1)|(v&0x80);break;case 6:v=((v<<4)|(v>>>4))&255;break;case 7:c=v&1;v>>>=1;}this.registers.f=(v===0?FLAG.ZERO:0)|(c?FLAG.CARRY:0);this.writeR(r,v,bus);return r===6?16:8;}this.writeR(r,v,bus);return r===6?16:8; }
  private alu(op:number,v:number):void {const r=this.registers,a=r.a;switch(op){case 0:case 1:{const c=op===1&&this.getFlag(FLAG.CARRY)?1:0;const sum=a+v+c;r.a=sum&255;r.f=(r.a===0?FLAG.ZERO:0)|(((a&15)+(v&15)+c>15)?FLAG.HALF_CARRY:0)|(sum>255?FLAG.CARRY:0);break;}case 2:case 3:case 7:{const c=op===3&&this.getFlag(FLAG.CARRY)?1:0;const n=a-v-c;r.f=FLAG.SUBTRACT|((n&255)===0?FLAG.ZERO:0)|((a&15)<((v&15)+c)?FLAG.HALF_CARRY:0)|(n<0?FLAG.CARRY:0);if(op!==7)r.a=n&255;break;}case 4:r.a&=v;r.f=(r.a===0?FLAG.ZERO:0)|FLAG.HALF_CARRY;break;case 5:r.a^=v;r.f=r.a===0?FLAG.ZERO:0;break;case 6:r.a|=v;r.f=r.a===0?FLAG.ZERO:0;}}
  private daa():void {const r=this.registers;let correction=0;let carry=this.getFlag(FLAG.CARRY);if(!this.getFlag(FLAG.SUBTRACT)){if(this.getFlag(FLAG.HALF_CARRY)||(r.a&15)>9)correction|=6;if(carry||r.a>0x99){correction|=0x60;carry=true;}r.a=(r.a+correction)&255;}else{if(this.getFlag(FLAG.HALF_CARRY))correction|=6;if(carry)correction|=0x60;r.a=(r.a-correction)&255;}r.f=(r.f&FLAG.SUBTRACT)|(r.a===0?FLAG.ZERO:0)|(carry?FLAG.CARRY:0);}
  private relative(bus:Bus,take:boolean):number {const e=this.fetch8(bus);if(take){this.registers.pc=(this.registers.pc+(e<128?e:e-256))&0xffff;return 12;}return 8;}
  private jump(bus:Bus,take:boolean):number {const address=this.fetch16(bus);if(take){this.registers.pc=address;return 16;}return 12;}
  private call(bus:Bus,take:boolean):number {const address=this.fetch16(bus);if(take){this.push(bus,this.registers.pc);this.registers.pc=address;return 24;}return 12;}
  private ret(bus:Bus,take:boolean):number {if(take){this.registers.pc=this.pop(bus);return 20;}return 8;}
  private fetch8(bus:Bus):number {const v=bus.read8(this.registers.pc);this.registers.pc=(this.registers.pc+1)&0xffff;return v;}
  private fetch16(bus:Bus):number {const lo=this.fetch8(bus);return lo|(this.fetch8(bus)<<8);}
  private readR(i:number,bus:Bus):number {const key=REGISTERS[i]!;return i===6?bus.read8(this.hl):this.registers[key as keyof CpuRegisters] as number;}
  private writeR(i:number,v:number,bus:Bus):void {if(i===6)bus.write8(this.hl,v);else this.registers[REGISTERS[i]! as Exclude<keyof CpuRegisters,'sp'|'pc'>]=v&255;}
  private getPair(i:number):number {switch(i){case 0:return this.bc;case 1:return this.de;case 2:return this.hl;default:return this.registers.sp;}}
  private setPair(i:number,v:number):void {const n=v&0xffff;switch(i){case 0:this.registers.b=n>>>8;this.registers.c=n&255;break;case 1:this.registers.d=n>>>8;this.registers.e=n&255;break;case 2:this.setHL(n);break;default:this.registers.sp=n;}}
  private setHL(v:number):void {const n=v&0xffff;this.registers.h=n>>>8;this.registers.l=n&255;}
  private push(bus:Bus,v:number):void {this.registers.sp=(this.registers.sp-1)&0xffff;bus.write8(this.registers.sp,v>>>8);this.registers.sp=(this.registers.sp-1)&0xffff;bus.write8(this.registers.sp,v&255);}
  private pop(bus:Bus):number {const lo=bus.read8(this.registers.sp);this.registers.sp=(this.registers.sp+1)&0xffff;const hi=bus.read8(this.registers.sp);this.registers.sp=(this.registers.sp+1)&0xffff;return lo|(hi<<8);}
}
