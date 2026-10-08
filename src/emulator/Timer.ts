import type { Bus } from './Bus';
import { INTERRUPT } from './constants';

/** Cycle-driven divider and programmable timer. */
export class Timer {
  private divider = 0;
  public reset(): void { this.divider = 0; }
  public tick(cycles: number, bus: Bus): void {
    for (let i = 0; i < cycles; i += 1) {
      if (bus.read8(0xff04) !== (this.divider >>> 8)) this.divider = 0;
      const previousDivider = this.divider;
      this.divider = (this.divider + 1) & 0xffff;
      if ((this.divider & 0xff) === 0) bus.incrementDivider();
      const tac = bus.read8(0xff07);
      if ((tac & 4) === 0) continue;
      const bit = [9, 3, 5, 7][tac & 3]!;
      if ((previousDivider & (1 << bit)) === 0 || (this.divider & (1 << bit)) !== 0) continue;
      const value = bus.read8(0xff05);
      if (value === 0xff) { bus.write8(0xff05, bus.read8(0xff06)); bus.write8(0xff0f, bus.read8(0xff0f) | INTERRUPT.TIMER); }
      else bus.write8(0xff05, value + 1);
    }
  }
}
