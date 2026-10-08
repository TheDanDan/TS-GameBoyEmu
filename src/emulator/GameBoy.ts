import { Bus } from './Bus'; import { Cpu } from './Cpu'; import { Joypad } from './Joypad'; import { Ppu } from './Ppu'; import { Timer } from './Timer'; import { createCartridge, type CartridgeHeader } from './cartridge';
export class GameBoy {
  public readonly bus = new Bus(); public readonly cpu = new Cpu(); public readonly ppu = new Ppu(); public readonly timer = new Timer(); public readonly joypad = new Joypad();
  public loadRom(buffer: ArrayBuffer): CartridgeHeader { const cartridge = createCartridge(buffer); this.bus.loadCartridge(cartridge); this.reset(); return cartridge.header; }
  public exportSaveRam(): Uint8Array | null { return this.bus.exportCartridgeRam(); }
  public importSaveRam(data: Uint8Array): void { this.bus.importCartridgeRam(data); }
  public reset(): void { this.bus.reset(); this.cpu.reset(); this.ppu.reset(); this.timer.reset(); this.joypad.reset(); }
  public step(): number {
    const selection=this.bus.read8(0xff00)&0x30,old=this.bus.read8(0xff00)&0x0f;const joyp=this.joypad.readRegister(selection);this.bus.write8(0xff00,joyp);
    if((old&~joyp&0x0f)!==0)this.bus.write8(0xff0f,this.bus.read8(0xff0f)|0x10);
    const cycles=this.cpu.step(this.bus);this.timer.tick(cycles,this.bus);if(this.ppu.tick(cycles,this.bus))this.ppu.renderFrame((address)=>this.bus.read8(address));return cycles;
  }
}
