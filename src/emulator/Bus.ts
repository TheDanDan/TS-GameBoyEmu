import type { Cartridge } from './cartridge';
import { MEMORY } from './constants';

export class Bus {
  private cartridge: Cartridge | undefined;
  private readonly vram = new Uint8Array(0x2000);
  private readonly workRam = new Uint8Array(0x2000); private readonly oam = new Uint8Array(0xa0);
  private readonly io = new Uint8Array(0x80); private readonly highRam = new Uint8Array(0x7f); private interruptEnable = 0;
  public loadCartridge(cartridge: Cartridge): void { this.cartridge = cartridge; }
  public incrementDivider(): void { this.io[0x04] = (this.io[0x04]! + 1) & 0xff; }
  public exportCartridgeRam(): Uint8Array | null { return this.cartridge?.exportRam?.() ?? null; }
  public importCartridgeRam(data: Uint8Array): void { this.cartridge?.importRam?.(data); }
  public reset(): void { this.cartridge?.reset?.(); this.vram.fill(0); this.workRam.fill(0); this.oam.fill(0); this.io.fill(0); this.io[0x00] = 0x30; this.io[0x40] = 0x91; this.io[0x47] = 0xfc; this.io[0x48] = 0xff; this.io[0x49] = 0xff; this.io[0x0f] = 0xe1; this.highRam.fill(0); this.interruptEnable = 0; }
  public read8(address: number): number { const a = address & 0xffff; if (a <= MEMORY.ROM_X_END) return this.cartridge?.read(a) ?? 0xff; if (a <= MEMORY.VRAM_END) return this.vram[a - MEMORY.VRAM_START]!; if (a <= MEMORY.EXTERNAL_RAM_END) return this.cartridge?.read(a) ?? 0xff; if (a <= MEMORY.WORK_RAM_END) return this.workRam[a - MEMORY.WORK_RAM_START]!; if (a <= MEMORY.ECHO_RAM_END) return this.workRam[a - MEMORY.ECHO_RAM_START]!; if (a <= MEMORY.OAM_END) return this.oam[a - MEMORY.OAM_START]!; if (a >= MEMORY.IO_START && a <= MEMORY.IO_END) return this.io[a - MEMORY.IO_START]!; if (a >= MEMORY.HIGH_RAM_START && a <= MEMORY.HIGH_RAM_END) return this.highRam[a - MEMORY.HIGH_RAM_START]!; return a === MEMORY.INTERRUPT_ENABLE ? this.interruptEnable : 0xff; }
  public read16(address: number): number { return this.read8(address) | (this.read8(address + 1) << 8); }
  public write8(address: number, value: number): void { const a = address & 0xffff; const v = value & 0xff; if (a <= MEMORY.ROM_X_END) this.cartridge?.write(a, v); else if (a <= MEMORY.VRAM_END) this.vram[a - MEMORY.VRAM_START] = v; else if (a <= MEMORY.EXTERNAL_RAM_END) this.cartridge?.write(a, v); else if (a <= MEMORY.WORK_RAM_END) this.workRam[a - MEMORY.WORK_RAM_START] = v; else if (a <= MEMORY.ECHO_RAM_END) this.workRam[a - MEMORY.ECHO_RAM_START] = v; else if (a <= MEMORY.OAM_END) this.oam[a - MEMORY.OAM_START] = v; else if (a >= MEMORY.IO_START && a <= MEMORY.IO_END) { if(a===0xff04)this.io[0x04]=0;else this.io[a - MEMORY.IO_START] = v; if (a === 0xff46) for (let i = 0; i < this.oam.length; i += 1) this.oam[i] = this.read8((v << 8) + i); } else if (a >= MEMORY.HIGH_RAM_START && a <= MEMORY.HIGH_RAM_END) this.highRam[a - MEMORY.HIGH_RAM_START] = v; else if (a === MEMORY.INTERRUPT_ENABLE) this.interruptEnable = v; }
  public write16(address: number, value: number): void { this.write8(address, value); this.write8(address + 1, value >>> 8); }
}
