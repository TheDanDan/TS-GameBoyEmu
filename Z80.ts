const Z80 = {
  // Time clock: The Z80 holds two types of clock (m and t)
  _clock: {m:0, t:0},

  // Register set
  _r: {
      a:0, b:0, c:0, d:0, e:0, h:0, l:0, f:0,    // 8-bit registers
      pc:0, sp:0,                                // 16-bit registers
      m:0, t:0                                   // Clock for last instr
  },

  reset: function() : void {
    this._r = {
      a:0, b:0, c:0, d:0, e:0, h:0, l:0, f:0,    // 8-bit registers
      pc:0, sp:0,                                // 16-bit registers
      m:0, t:0                                   // Clock for last instr
    };

    this._clock = {m:0, t:0}
  },

  // Add E to A, leaving result in A (ADD A, E)
  ADDr_e: function() {
    Z80._r.a += Z80._r.e;                      // Perform addition
    Z80._r.f = 0;                              // Clear flags
    if(!(Z80._r.a & 255)) Z80._r.f |= 0x80;    // Check for zero
    if(Z80._r.a > 255) Z80._r.f |= 0x10;       // Check for carry
    Z80._r.a &= 255;                           // Mask to 8-bits
    Z80._r.m = 1; Z80._r.t = 4;                // 1 M-time taken
  },

// Compare B to A, setting flags (CP A, B)
  CPr_b: function() {
      var i = Z80._r.a;                          // Temp copy of A
      i -= Z80._r.b;                             // Subtract B
      Z80._r.f |= 0x40;                          // Set subtraction flag
      if(!(i & 255)) Z80._r.f |= 0x80;           // Check for zero
      if(i < 0) Z80._r.f |= 0x10;                // Check for underflow
      Z80._r.m = 1; Z80._r.t = 4;                // 1 M-time taken
  },

  // No-operation (NOP)
  NOP: function() {
    Z80._r.m = 1; Z80._r.t = 4;                // 1 M-time taken
  },

  // Push registers B and C to the stack (PUSH BC)
  PUSHBC: function() {
    Z80._r.sp--;                               // Drop through the stack
    MMU.wb(Z80._r.sp, Z80._r.b);               // Write B
    Z80._r.sp--;                               // Drop through the stack
    MMU.wb(Z80._r.sp, Z80._r.c);               // Write C
    Z80._r.m = 3; Z80._r.t = 12;               // 3 M-times taken
  },

  // Pop registers H and L off the stack (POP HL)
  POPHL: function() {
    Z80._r.l = MMU.rb(Z80._r.sp);              // Read L
    Z80._r.sp++;                               // Move back up the stack
    Z80._r.h = MMU.rb(Z80._r.sp);              // Read H
    Z80._r.sp++;                               // Move back up the stack
    Z80._r.m = 3; Z80._r.t = 12;               // 3 M-times taken
  },

  // Read a byte from absolute location into A (LD A, addr)
  LDAmm: function() {
    var addr : number = MMU.rw(Z80._r.pc);     // Get address from instr
    Z80._r.pc += 2;                            // Advance PC
    Z80._r.a = MMU.rb(addr);                   // Read from address
    Z80._r.m = 4; Z80._r.t=16;                 // 4 M-times taken
  }
};

while(true){
    var op = MMU.rb(Z80._r.pc++);              // Fetch instruction
    Z80._map[op]();                            // Dispatch
    Z80._r.pc &= 65535;                        // Mask PC to 16 bits
    Z80._clock.m += Z80._r.m;                  // Add time to CPU clock
    Z80._clock.t += Z80._r.t;
}
