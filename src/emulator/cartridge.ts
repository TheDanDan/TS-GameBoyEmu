export interface CartridgeHeader { title: string; type: number; romSizeCode: number; ramSizeCode: number; batteryBacked: boolean; }
export interface Cartridge { readonly header: CartridgeHeader; read(address: number): number; write(address: number, value: number): void; reset?(): void; exportRam?(): Uint8Array; importRam?(data: Uint8Array): void; }

export function parseCartridgeHeader(rom: Uint8Array): CartridgeHeader {
  if (rom.length < 0x150) throw new Error('ROM is too small to contain a Game Boy header.');
  let title = '';
  for (let address = 0x134; address <= 0x143 && rom[address] !== 0; address += 1) title += String.fromCharCode(rom[address]!);
  const type=rom[0x147]!;
  return { title, type, romSizeCode: rom[0x148]!, ramSizeCode: rom[0x149]!, batteryBacked: type===0x03||type===0x09 };
}

const ROM_BANKS: Record<number, number> = { 0: 2, 1: 4, 2: 8, 3: 16, 4: 32, 5: 64, 6: 128, 7: 256, 8: 512, 0x52: 72, 0x53: 80, 0x54: 96 };
const RAM_BYTES: Record<number, number> = { 0: 0, 1: 0x800, 2: 0x2000, 3: 0x8000, 4: 0x20000, 5: 0x10000 };

abstract class BaseCartridge implements Cartridge {
  public readonly header: CartridgeHeader;
  protected readonly rom: Uint8Array;
  protected readonly ram: Uint8Array;
  protected constructor(buffer: ArrayBuffer) {
    this.rom = new Uint8Array(buffer.slice(0)); this.header = parseCartridgeHeader(this.rom);
    const expectedBanks = ROM_BANKS[this.header.romSizeCode];
    if (!expectedBanks || this.rom.length !== expectedBanks * 0x4000) throw new Error('ROM length does not match its cartridge header.');
    this.ram = new Uint8Array(RAM_BYTES[this.header.ramSizeCode] ?? 0);
  }
  public abstract read(address: number): number;
  public abstract write(address: number, value: number): void;
  public exportRam():Uint8Array{return new Uint8Array(this.ram);}
  public importRam(data:Uint8Array):void{this.ram.set(data.subarray(0,this.ram.length));}
  protected readRam(address: number, bank = 0): number { if (!this.ram.length) return 0xff; return this.ram[(bank * 0x2000 + (address & 0x1fff)) % this.ram.length]!; }
  protected writeRam(address: number, value: number, bank = 0): void { if (this.ram.length) this.ram[(bank * 0x2000 + (address & 0x1fff)) % this.ram.length] = value; }
}

export class RomOnlyCartridge extends BaseCartridge {
  public constructor(buffer: ArrayBuffer) { super(buffer); if (![0x00, 0x08, 0x09].includes(this.header.type)) throw new Error(`Unsupported cartridge mapper/type 0x${this.header.type.toString(16).padStart(2, '0')}.`); }
  public read(address: number): number { if (address < 0x8000) return this.rom[address] ?? 0xff; if (address >= 0xa000 && address <= 0xbfff && (this.header.type === 0x08 || this.header.type === 0x09)) return this.readRam(address); return 0xff; }
  public write(address: number, value: number): void { if (address >= 0xa000 && address <= 0xbfff && (this.header.type === 0x08 || this.header.type === 0x09)) this.writeRam(address, value); }
}

export class Mbc1Cartridge extends BaseCartridge {
  private ramEnabled = false; private romLow = 1; private bankHigh = 0; private bankingMode = 0;
  public constructor(buffer: ArrayBuffer) { super(buffer); if (![0x01, 0x02, 0x03].includes(this.header.type)) throw new Error(`Unsupported cartridge mapper/type 0x${this.header.type.toString(16).padStart(2, '0')}.`); }
  public reset(): void { this.ramEnabled = false; this.romLow = 1; this.bankHigh = 0; this.bankingMode = 0; }
  public read(address: number): number {
    const banks = this.rom.length >>> 14;
    if (address < 0x4000) { const bank = this.bankingMode ? (this.bankHigh << 5) % banks : 0; return this.rom[bank * 0x4000 + address]!; }
    if (address < 0x8000) { const bank = (((this.bankHigh << 5) | this.romLow) % banks) || 1; return this.rom[bank * 0x4000 + address - 0x4000]!; }
    if (address >= 0xa000 && address <= 0xbfff && this.ramEnabled) return this.readRam(address, this.bankingMode ? this.bankHigh : 0);
    return 0xff;
  }
  public write(address: number, value: number): void {
    const v = value & 0xff;
    if (address < 0x2000) this.ramEnabled = (v & 0x0f) === 0x0a;
    else if (address < 0x4000) { this.romLow = (v & 0x1f) || 1; }
    else if (address < 0x6000) this.bankHigh = v & 3;
    else if (address < 0x8000) this.bankingMode = v & 1;
    else if (address >= 0xa000 && address <= 0xbfff && this.ramEnabled) this.writeRam(address, v, this.bankingMode ? this.bankHigh : 0);
  }
}

export function createCartridge(buffer: ArrayBuffer): Cartridge {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 0x150) throw new Error('ROM is too small to contain a Game Boy header.');
  const type = bytes[0x147]!;
  if (type >= 0x01 && type <= 0x03) return new Mbc1Cartridge(buffer);
  return new RomOnlyCartridge(buffer);
}
