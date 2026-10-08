# Five-Day React + TypeScript Game Boy Emulator Plan

## Scope and success target

Build a browser-based, **DMG (original monochrome Game Boy)** emulator that lets a
user load their own `.gb` ROM, shows video in a React canvas, accepts keyboard
input, and runs selected public test ROMs. The first release deliberately excludes
audio, Game Boy Color, link cable, save states, rewind, and every cartridge mapper
except ROM-only and MBC1.

The repository already contains an experimental CPU (`convert/Z80.ts`), memory
bus, GPU, timer, and input code. They rely on globals and browser/Node-specific
APIs, so treat them as a behavioral reference rather than wiring them directly
into the UI.

Do not bundle commercial ROMs, BIOS files, or Nintendo assets. Support user-supplied
ROMs and use public-domain/homebrew diagnostics during development.

## Day 1 — Establish a runnable, testable foundation

- Create a Vite React + TypeScript application with strict TypeScript, ESLint, and
  Vitest.
- Define a hardware-independent core under `src/emulator/`: `GameBoy`, `Cpu`,
  `Bus`, `Ppu`, `Timer`, `Joypad`, and cartridge interfaces. Use classes or
  explicit dependency injection—no global singletons and no DOM access in the
  core.
- Add typed constants for memory ranges, registers, interrupt masks, CPU flags,
  and clock rates. Use `Uint8Array`/`Uint16Array` rather than JavaScript arrays.
- Port/reset the CPU register state and the 64 KiB address map skeleton; implement
  ROM loading from an `ArrayBuffer`, cartridge-header parsing, and ROM-only reads.
- Add unit-test helpers that load byte fixtures and assert registers, flags,
  program counter, memory writes, and cycle counts.

**Done when:** `npm run dev`, `npm test`, and `npm run build` pass; a unit test can
execute a small ROM program through the bus without a browser.

## Day 2 — Complete CPU execution and memory/interrupt correctness

- Port the complete LR35902 instruction set from `convert/Z80.ts`, but reorganize
  it as a typed opcode table. Implement base and `0xCB` opcodes, signed offsets,
  flag behavior, `HALT`, `STOP`, `DI`, `EI`, stack operations, and the correct
  machine-cycle return from each instruction.
- Implement work RAM, echo RAM, high RAM, VRAM/OAM backing stores, I/O dispatch,
  ROM-only, and MBC1 banking (ROM/RAM enable, bank selection, RAM banking mode).
- Implement `IE`/`IF`, interrupt priority/vectors, IME delayed enabling, and the
  CPU interrupt service sequence.
- Add focused instruction and integration tests, then run a public CPU diagnostic
  ROM in a headless test harness. Record known failures as issues rather than
  hiding them with per-ROM hacks.

**Done when:** opcode tests cover all implemented tables, CPU diagnostics reach
their pass banner (or have a short, documented failure list), and MBC1 bank reads
are tested.

## Day 3 — Timing, LCD rendering, and browser frame loop

- Make the timer advance from CPU cycles, including DIV/TIMA/TMA/TAC behavior and
  timer interrupts. Add DMA from `FF46` to OAM.
- Implement the DMG PPU timing state machine (OAM scan, pixel transfer, HBlank,
  VBlank), LY/LYC coincidence, STAT/VBlank interrupts, LCD enable transitions,
  and VRAM/OAM access restrictions.
- Render background and window tile maps, tile addressing modes, scrolling,
  palettes, then sprite attributes (priority, flipping, 8×16 mode, 10 sprites per
  scanline) into a 160×144 RGBA frame buffer.
- Expose frames through a canvas component; drive emulation with
  `requestAnimationFrame`, a cycle budget, and a maximum catch-up cap so the UI
  stays responsive.

**Done when:** a frame is exactly 160×144, VBlank occurs at roughly 59.7 Hz, and
public PPU timing/rendering diagnostics show their expected output.

## Day 4 — React product shell, controls, and resilience

- Build the React UI: ROM drop zone/file picker, canvas display with integer
  scaling, run/pause/reset controls, speed selector, status/error panel, and a
  compact control legend.
- Connect keyboard controls with prevent-default handling while focused:
  arrows → D-pad, `Z`/`X` → B/A, Shift → Select, Enter → Start. Implement the
  joypad register and joypad interrupt; add touch controls only if time remains.
- Keep the emulator instance in a React ref; use lifecycle-safe attach/detach for
  animation and input handlers. Validate ROM size/header and present user-facing
  unsupported-mapper errors instead of crashing.
- Add battery-backed RAM persistence for supported carts using `localStorage`,
  keyed by a SHA-256 ROM hash, and clearly label the browser-storage behavior.

**Done when:** loading, pausing, resetting, keyboard play, mapper errors, and a
page refresh with persisted supported save RAM all work in the browser.

## Day 5 — Compatibility pass, QA, and release-ready delivery

- Run a small compatibility matrix: CPU, timer, interrupt, PPU, and MBC1 public
  diagnostics plus several legally obtained/homebrew ROMs. Capture screenshots
  and exact pass/fail versions in the README.
- Fix root causes revealed by diagnostics; prioritize CPU flags/cycles, interrupt
  timing, LCD state transitions, and mapper behavior over polish.
- Add component tests for ROM-loading/error states and end-to-end browser checks
  for the main load/play/pause/reset flow. Profile for stable frame pacing and
  memory leaks after repeated ROM loads.
- Finish README: supported hardware/mappers, controls, legal ROM policy, local
  development commands, known limitations, and architecture diagram. Configure a
  CI workflow to type-check, lint, test, and build on pull requests.

**Done when:** CI passes, the compatibility matrix is published, a user can clone
the project and run a supported ROM locally, and limitations are explicit.

## Recommended checkpoints

Commit at the end of each day and keep public test-ROM outputs outside the app
bundle. If a Day 2 or Day 3 diagnostic is failing broadly, spend the next morning
on correctness before moving to UI features: emulators become much harder to fix
after timing assumptions spread across the codebase.
