import { GameBoy } from './GameBoy';
export function romWithProgram(program: readonly number[], start = 0x100): ArrayBuffer { const rom = new Uint8Array(0x8000); rom[0x147] = 0; rom.set(program, start); return rom.buffer; }
export function gameBoyWithProgram(program: readonly number[]): GameBoy { const gameBoy = new GameBoy(); gameBoy.loadRom(romWithProgram(program)); return gameBoy; }
