export const CLOCK_HZ = 4_194_304;

export const MEMORY = {
  ROM_0_START: 0x0000, ROM_0_END: 0x3fff, ROM_X_START: 0x4000, ROM_X_END: 0x7fff,
  VRAM_START: 0x8000, VRAM_END: 0x9fff, EXTERNAL_RAM_START: 0xa000, EXTERNAL_RAM_END: 0xbfff,
  WORK_RAM_START: 0xc000, WORK_RAM_END: 0xdfff, ECHO_RAM_START: 0xe000, ECHO_RAM_END: 0xfdff,
  OAM_START: 0xfe00, OAM_END: 0xfe9f, IO_START: 0xff00, IO_END: 0xff7f,
  HIGH_RAM_START: 0xff80, HIGH_RAM_END: 0xfffe, INTERRUPT_ENABLE: 0xffff,
} as const;

export const IO = { JOYP: 0xff00, DIV: 0xff04, TIMA: 0xff05, TMA: 0xff06, TAC: 0xff07, IF: 0xff0f } as const;
export const INTERRUPT = { VBLANK: 0x01, LCD_STAT: 0x02, TIMER: 0x04, SERIAL: 0x08, JOYPAD: 0x10 } as const;
export const FLAG = { ZERO: 0x80, SUBTRACT: 0x40, HALF_CARRY: 0x20, CARRY: 0x10 } as const;
