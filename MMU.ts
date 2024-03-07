const MMU = {
  rb: function(addr: number) { return addr },
  rw: function(addr: number) { return addr },

  wb: function(addr: number, val: number) { addr = val },
  ww: function(addr: number, val: number) { addr = val }
};