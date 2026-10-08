import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { GameBoy } from './emulator/GameBoy';
import type { Button } from './emulator/Joypad';
import './styles.css';

const FRAME_CYCLES = 70_224;
const PREF_KEY = 'tsboy-appearance-v1';
const KEY_MAP: Record<string, Button> = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', z: 'b', x: 'a', Shift: 'select', Enter: 'start' };
type Shell = 'sage' | 'lilac' | 'clay';
type Palette = 'classic' | 'blue' | 'amber' | 'mono';
type Preferences = { shell: Shell; palette: Palette };
const DEFAULT_PREFS: Preferences = { shell: 'sage', palette: 'classic' };
function readPreferences(): Preferences { try { const value = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null') as Partial<Preferences> | null; return { shell: value?.shell === 'lilac' || value?.shell === 'clay' ? value.shell : 'sage', palette: value?.palette === 'blue' || value?.palette === 'amber' || value?.palette === 'mono' ? value.palette : 'classic' }; } catch { return DEFAULT_PREFS; } }
async function saveKeyFor(buffer:ArrayBuffer):Promise<string|null>{try{const digest=await crypto.subtle.digest('SHA-256',buffer);return `tsboy-save-${Array.from(new Uint8Array(digest),(b)=>b.toString(16).padStart(2,'0')).join('')}`;}catch{return null;}}
function encode64(data:Uint8Array):string{let binary='';for(let i=0;i<data.length;i+=0x8000)binary+=String.fromCharCode(...data.subarray(i,i+0x8000));return btoa(binary);}
function decode64(value:string):Uint8Array{const binary=atob(value);return Uint8Array.from(binary,(char)=>char.charCodeAt(0));}
function GameControl({ button, gameRef, className, label, children }: { button: Button; gameRef: RefObject<GameBoy | null>; className?: string; label?: string; children: ReactNode }) { return <button className={className} aria-label={label} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); gameRef.current?.joypad.setPressed(button, true); }} onPointerUp={() => gameRef.current?.joypad.setPressed(button, false)} onPointerCancel={() => gameRef.current?.joypad.setPressed(button, false)}>{children}</button>; }

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<ImageData | null>(null);
  const gameRef = useRef<GameBoy | null>(null);
  const animationRef = useRef<number>(0);
  const [preferences, setPreferences] = useState(readPreferences);
  const [showCustomize, setShowCustomize] = useState(false);
  const [romName, setRomName] = useState('');
  const [status, setStatus] = useState('Waiting for a game');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const [saveKey, setSaveKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const setPref = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...preferences, [key]: value }; setPreferences(next); try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* Preferences are optional when storage is unavailable. */ } gameRef.current?.ppu.setPalette(next.palette);
  }, [preferences]);

  const load = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.gb')) throw new Error('Choose a Game Boy .gb ROM file.');
      if (file.size > 8 * 1024 * 1024) throw new Error('This ROM is larger than the supported 8 MB limit.');
      const buffer=await file.arrayBuffer();const gb = new GameBoy(); const header = gb.loadRom(buffer); gb.ppu.setPalette(preferences.palette);const key=header.batteryBacked?await saveKeyFor(buffer):null;if(key){try{const stored=localStorage.getItem(key);if(stored)gb.importSaveRam(decode64(stored));}catch{/* Invalid or unavailable browser saves are ignored. */}}setSaveKey(key);gameRef.current = gb;
      setRomName(header.title.trim().replace(/[^\x20-\x7e]/g, '') || file.name); setError(''); setStatus('Ready to play'); setRunning(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This ROM could not be loaded.'); setRunning(false); setStatus('Could not load ROM'); }
  }, [preferences.palette]);

  const reset = useCallback(() => { if (!gameRef.current) return; gameRef.current.reset(); gameRef.current.ppu.setPalette(preferences.palette); setRunning(false); setError(''); setStatus('Game reset'); }, [preferences.palette]);

  useEffect(() => {
    if (!running) return;
    let previous = 0; let budget = 0; let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      const elapsed = previous ? Math.min(now - previous, 50) : 0; previous = now;
      budget = Math.min(budget + elapsed * 4194.304 * speed, FRAME_CYCLES * speed * 2);
      try {
        const game = gameRef.current;
        if (game) {
          let elapsedCycles = 0;
          while (budget >= 4 && elapsedCycles < FRAME_CYCLES * speed * 2) { const cycles = game.step(); budget -= cycles; elapsedCycles += cycles; }
          const canvas = canvasRef.current; const context = canvas?.getContext('2d');
          if (canvas && context) { imageRef.current ??= context.createImageData(160, 144); imageRef.current.data.set(game.ppu.frame); context.putImageData(imageRef.current, 0, 0); }
        }
      } catch (reason) { alive = false; setRunning(false); setStatus('Execution stopped'); setError(reason instanceof Error ? reason.message : 'The game stopped unexpectedly.'); return; }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(animationRef.current); };
  }, [running, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { const button = KEY_MAP[event.key] ?? KEY_MAP[event.key.toLowerCase()]; if (!button || (document.activeElement instanceof HTMLElement && ['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName))) return; event.preventDefault(); gameRef.current?.joypad.setPressed(button, event.type === 'keydown'); };
    const release = () => { for (const button of Object.values(KEY_MAP)) gameRef.current?.joypad.setPressed(button, false); };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', release);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', release); release(); };
  }, []);

  useEffect(() => {
    if(!saveKey)return;
    const game=gameRef.current;if(!game)return;
    const persist=()=>{try{const data=game.exportSaveRam();if(data?.length)localStorage.setItem(saveKey,encode64(data));}catch{/* Storage can be disabled or full; gameplay continues. */}};
    const timer=window.setInterval(persist,10_000);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',persist);
    return()=>{window.clearInterval(timer);window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',persist);persist();};
  },[saveKey,running]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => { void load(event.target.files?.[0]); event.target.value = ''; };

  return <main className="app" data-shell={preferences.shell}>
    <header className="masthead">
      <a className="wordmark" href="#home" aria-label="tsboy home"><span className="wordmark-icon">t<span>·</span></span><span className="wordmark-name">tsboy<small>POCKET PLAYER</small></span></a>
      <div className="head-status"><span className={`status-light ${running ? 'is-live' : ''}`} />{running ? 'RUNNING' : romName ? 'ON PAUSE' : 'DMG / 01'}</div>
      <button className={`customize-toggle ${showCustomize ? 'selected' : ''}`} onClick={() => setShowCustomize(!showCustomize)} aria-expanded={showCustomize}><span className="sliders-icon">☷</span><span>Make it yours</span></button>
    </header>

    {showCustomize && <section className="customizer" aria-label="Appearance settings"><div className="custom-copy"><span className="overline">YOUR POCKET, YOUR PALETTE</span><strong>A few little finishing touches.</strong></div><div className="setting"><span>Console shell</span><div className="swatches" role="group" aria-label="Console shell color"><button className="swatch sage" aria-label="Sage shell" aria-pressed={preferences.shell === 'sage'} onClick={() => setPref('shell', 'sage')} /><button className="swatch lilac" aria-label="Lilac shell" aria-pressed={preferences.shell === 'lilac'} onClick={() => setPref('shell', 'lilac')} /><button className="swatch clay" aria-label="Clay shell" aria-pressed={preferences.shell === 'clay'} onClick={() => setPref('shell', 'clay')} /></div></div><label className="setting palette-setting"><span>Screen tones</span><select value={preferences.palette} onChange={(event) => setPref('palette', event.target.value as Palette)}><option value="classic">Field green</option><option value="blue">Rainy day</option><option value="amber">Soft amber</option><option value="mono">Ink study</option></select></label><span className="saved-note">Saved on this device <span>↗</span></span></section>}

    <section className="stage">
      <section className={`player-card ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void load(event.dataTransfer.files[0]); }} aria-label="Game screen and controls">
        <div className="card-rail"><span>TSB / POCKET HARDWARE</span><span className="rail-right"><span className="rail-spark">✳</span> 160 × 144</span></div>
        <div className="screen-surround"><div className="screen-label"><span>DISPLAY WINDOW · {status.toUpperCase()}</span><span className="led"><i /> LIVE</span></div><div className="screen-well"><canvas ref={canvasRef} width={160} height={144} aria-label="Game screen" /><div className={`idle-screen ${romName ? 'is-hidden' : ''}`}><span className="idle-sun">◉</span><strong>A small world<br />is waiting.</strong><span>Choose a ROM to switch it on</span></div><div className="drop-hint">LET GO TO LOAD</div></div><div className="screen-mark"><span>tsboy</span><span className="mark-divider" /><span className="model-number">DMG—01</span></div></div>
        <div className="control-deck"><div className="dpad" aria-label="Directional controls"><GameControl className="up" label="Up" button="up" gameRef={gameRef}>⌃</GameControl><GameControl className="left" label="Left" button="left" gameRef={gameRef}>‹</GameControl><span className="dpad-hub">✳</span><GameControl className="right" label="Right" button="right" gameRef={gameRef}>›</GameControl><GameControl className="down" label="Down" button="down" gameRef={gameRef}>⌄</GameControl></div><div className="console-script"><span>PLAY A LITTLE.</span><span>STAY A WHILE.</span></div><div className="face-buttons"><GameControl className="face-button b-button" label="B button" button="b" gameRef={gameRef}><span>B</span></GameControl><GameControl className="face-button a-button" label="A button" button="a" gameRef={gameRef}><span>A</span></GameControl></div></div>
        <div className="lower-deck"><div className="system-keys"><GameControl button="select" gameRef={gameRef}>SELECT</GameControl><GameControl button="start" gameRef={gameRef}>START</GameControl></div><div className="speaker"><span>••••••</span><span>••••••</span><span>••••••</span><span>••••••</span></div><button className="expand-button" onClick={async () => { const screen = canvasRef.current?.parentElement; if (!screen) return; if (document.fullscreenElement) await document.exitFullscreen(); else await screen.requestFullscreen(); }} aria-label="Toggle full screen" title="Full screen">⛶</button></div>
        <div className="drop-overlay" aria-hidden="true"><span>✳</span><strong>Drop it like it’s 1999.</strong><small>Release your .gb file to load</small></div>
      </section>

      <aside className="sidecar">
        <div className="intro-block"><span className="overline">A TINY BIT OF MAGIC</span><h1>Press play.<br /><em>Go somewhere.</em></h1><p>Your old favourites, in a new little window. Bring a game and make yourself at home.</p></div>
        <label className="load-card"><span className="load-glyph">＋</span><span className="load-words"><strong>{romName ? 'Change game' : 'Bring a game'}</strong><small>Choose or drop a .gb file</small></span><span className="load-arrow">↗</span><input type="file" accept=".gb,application/octet-stream" onChange={chooseFile} /></label>
        <div className="now-card"><div className="now-top"><div className="cover-stamp"><span>{romName ? 'PLAY' : '—'}</span><i>✳</i></div><div className="now-title"><span className="overline">ON THE CARTRIDGE</span><strong title={romName}>{romName || 'Your next adventure'}</strong><span className="cart-meta">{romName ? 'GAME BOY · DMG' : 'NOTHING LOADED YET'}</span></div><span className={`activity-mark ${running ? 'active' : ''}`} title={running ? 'Emulation running' : 'Paused'} /></div>
          <div className="now-actions"><button className="play-button" disabled={!romName} onClick={() => { const next = !running; setRunning(next); setStatus(next ? `Playing · ${speed}×` : 'Paused'); }}>{running ? <><span>Ⅱ</span> Take a breath</> : <><span>▶</span> {romName ? 'Play again' : 'Ready when you are'}</>}</button><button className="reset-button" disabled={!romName} onClick={reset} aria-label="Reset game" title="Reset game">↺</button><label className="speed-control"><span className="sr-only">Emulation speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
        </div>
        {error && <div className="error-note" role="alert"><span>!</span><div><strong>Couldn’t start this one.</strong><small>{error}</small></div></div>}
        <div className="key-guide"><div className="guide-heading"><span className="overline">THE LITTLE BUTTONS</span><span>01—08</span></div><div className="guide-row"><span className="key-cluster"><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>Move about</span></div><div className="guide-row"><span className="key-cluster"><kbd>Z</kbd><kbd>X</kbd></span><span>B · A</span></div><div className="guide-row"><span className="key-cluster"><kbd>SHIFT</kbd><kbd>ENTER</kbd></span><span>Select · Start</span></div></div>
        <p className="local-note"><span>⌂</span> {saveKey ? 'Battery saves stay in this browser.' : 'Your game stays here; nothing is uploaded.'}</p>
      </aside>
    </section>
    <footer className="footer"><span><i>✳</i> INDEPENDENTLY MADE, GENTLY PLAYED</span><span>Not affiliated with Nintendo <b>·</b> Only use games you’re entitled to</span></footer>
  </main>;
}
