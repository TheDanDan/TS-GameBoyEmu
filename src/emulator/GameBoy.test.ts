import { describe, expect, it } from 'vitest';
import { FLAG } from './constants'; import { gameBoyWithProgram, romWithProgram } from './testUtils'; import { parseCartridgeHeader } from './cartridge';

describe('Day 1 emulator foundation', () => {
  it('loads a ROM-only header', () => { const bytes = new Uint8Array(romWithProgram([])); bytes.set([...'TSBOY'].map((c) => c.charCodeAt(0)), 0x134); expect(parseCartridgeHeader(bytes)).toMatchObject({ title: 'TSBOY', type: 0 }); });
  it('executes a small ROM program through the bus', () => { const gb = gameBoyWithProgram([0x21, 0x00, 0xc0, 0x3e, 0x42, 0x77, 0xaf]); expect(gb.step()).toBe(12); expect(gb.step()).toBe(8); expect(gb.step()).toBe(8); expect(gb.bus.read8(0xc000)).toBe(0x42); expect(gb.step()).toBe(4); expect(gb.cpu.registers.a).toBe(0); expect(gb.cpu.getFlag(FLAG.ZERO)).toBe(true); expect(gb.cpu.registers.pc).toBe(0x107); });
  it('maps work RAM and its echo using typed 8- and 16-bit bus access', () => { const gb = gameBoyWithProgram([]); gb.bus.write16(0xc123, 0xbeef); expect(gb.bus.read8(0xe123)).toBe(0xef); expect(gb.bus.read16(0xc123)).toBe(0xbeef); });
});
