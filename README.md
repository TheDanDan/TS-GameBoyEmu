# tsboy

An independent, browser-based Nintendo Game Boy DMG player. Bring a `.gb` ROM you are entitled to use, settle into the pocket-sized player, and choose a console finish and screen palette to suit your mood. ROMs are read locally and never uploaded.

## Run it

```sh
npm install
npm run dev
```

`npm run build` creates the production site. `npm run lint` runs static checks, and `npm test` runs the emulator unit tests. GitHub Actions runs all three checks for pushes to `main` and pull requests.

## Controls

| Game Boy control | Keyboard | On-screen control |
| --- | --- | --- |
| D-pad | Arrow keys | Direction pad |
| B / A | Z / X | B / A buttons |
| Select / Start | Shift / Enter | Select / Start buttons |

The play screen accepts `.gb` files by drag and drop. Emulation speed can be set to ½×, 1×, 2×, or 4×. The appearance panel lets you choose three console shell colors and four DMG screen palettes; those preferences stay in local browser storage.

## Emulation support

- LR35902 base and CB-prefixed instructions, CPU flags and instruction cycle counts, HALT/STOP, delayed EI, and interrupt dispatch.
- ROM-only cartridges and MBC1 banking, including external RAM.
- DMG background, window, and sprite composition, scrolling, sprite flips and priority, DMA transfer, joypad input, divider/TIMA timer, LY/STAT updates, and VBlank/LCD/timer/joypad interrupt requests.
- Battery-backed RAM is stored in local browser storage under a SHA-256 key for the ROM. It is saved periodically and when the page is hidden or closed.

The target is original DMG hardware. Color Game Boy, link cable, serial transfer, boot ROM emulation, audio, save states, and cartridge types outside ROM-only/MBC1 are not supported. PPU modes and interrupt timing are approximations rather than transistor-level timing, and public diagnostic-ROM compatibility has not yet been certified. ROMs with headers that claim an unsupported mapper or have a mismatched declared size are rejected with an explanation.

No commercial ROMs, BIOS files, or Nintendo assets are included. Only load games you are legally entitled to use. This independent project is not affiliated with Nintendo.

## Structure

```text
React player ── file input / controls / canvas / animation clock
     │
GameBoy coordinator
     ├── CPU ── memory bus ── ROM-only or MBC1 cartridge
     ├── timer and interrupt registers
     ├── PPU ── 160 × 144 DMG framebuffer
     └── joypad state
```

The emulator core lives in `src/emulator` and has no browser dependencies. React owns user input, rendering, browser storage, and lifecycle management.
