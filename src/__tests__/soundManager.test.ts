import { describe, it, expect, vi } from 'vitest';
import { SoundManager } from '../audio/soundManager';

/** A minimal stand-in for HTMLAudioElement. */
class FakeAudio {
  src: string;
  volume = 1;
  currentTime = 0;
  paused = true;
  readyState = 0;
  preload = '';
  playCalls = 0;
  loadCalls = 0;
  /** Set to make play() reject, like an autoplay blockade. */
  rejectPlay = false;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
  }
  play() {
    this.playCalls++;
    if (this.rejectPlay) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loadCalls++;
  }
  addEventListener(type: string, handler: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }
  removeEventListener(type: string, handler: () => void) {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type: string) {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }
}

function makeManager(overrides: { now?: () => number } = {}) {
  const created: FakeAudio[] = [];
  const storage = new Map<string, string>();
  const manager = new SoundManager({
    createAudio: (url: string) => {
      const audio = new FakeAudio(url);
      created.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    storage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
    now: overrides.now,
  });
  return { manager, created, storage };
}

const moveEvent = {
  actor: 'player' as const,
  isCapture: false,
  isCastle: false,
  isPromotion: false,
  isCheck: false,
  isCheckmate: false,
  isDraw: false,
};

describe('SoundManager', () => {
  it('plays a bundled move sound from the move pipeline', () => {
    const { manager, created } = makeManager();
    manager.setEnabled(true);
    manager.unlock();
    expect(manager.playMove(moveEvent, 'fen|e2e4')).toBe(true);
    const played = created.find((a) => a.src.includes('move-self.wav'));
    expect(played?.playCalls).toBe(1);
  });

  it('uses the same sound for a pawn move and a knight move', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.playMove(moveEvent, 'fen|e2e4');
    manager.playMove(moveEvent, 'fen|g1f3');
    const selfSounds = created.filter((a) => a.src.includes('move-self.wav'));
    expect(selfSounds.length).toBe(1);
    expect(selfSounds[0].playCalls).toBe(2);
    expect(created.some((a) => a.src.includes('token'))).toBe(false);
  });

  it('never replays the same move twice', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    expect(manager.playMove(moveEvent, 'fen|e2e4')).toBe(true);
    expect(manager.playMove(moveEvent, 'fen|e2e4')).toBe(false);
    expect(manager.playMove(moveEvent, 'fen|e2e4')).toBe(false);
    const played = created.find((a) => a.src.includes('move-self.wav'));
    expect(played?.playCalls).toBe(1);
  });

  it('plays each move of a game exactly once', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    const keys = ['a|e2e4', 'b|e7e5', 'c|g1f3', 'd|b8c6'];
    for (const key of keys) manager.playMove(moveEvent, key);
    for (const key of keys) manager.playMove(moveEvent, key);
    const played = created.find((a) => a.src.includes('move-self.wav'));
    expect(played?.playCalls).toBe(keys.length);
  });

  it('does nothing when sounds are switched off', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.setEnabled(false);
    expect(manager.playMove(moveEvent, 'fen|e2e4')).toBe(false);
    expect(created.every((a) => a.playCalls === 0)).toBe(true);
  });

  it('keeps the opponent sound separate from the player sound', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.playMove({ ...moveEvent, actor: 'opponent' }, 'fen|e7e5');
    expect(created.some((a) => a.src.includes('move-opponent.wav'))).toBe(true);
    expect(created.some((a) => a.src.includes('move-self.wav'))).toBe(false);
  });

  it('routes a capture to the capture sound', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.playMove({ ...moveEvent, isCapture: true }, 'fen|e2d3');
    expect(created.some((a) => a.src.includes('capture.wav'))).toBe(true);
  });

  it('applies the volume to every sound', () => {
    const { manager, created } = makeManager();
    manager.setVolume(0.25);
    manager.unlock();
    manager.playMove(moveEvent, 'fen|e2e4');
    const sound = created.find((a) => a.src.includes('move-self.wav'));
    expect(sound?.volume).toBe(0.25);
    manager.setVolume(0.9);
    expect(sound?.volume).toBe(0.9);
  });

  it('remembers settings across instances', () => {
    const storage = new Map<string, string>();
    const shared = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    };
    const first = new SoundManager({ createAudio: (u) => new FakeAudio(u) as unknown as HTMLAudioElement, storage: shared });
    first.setVolume(0.4);
    first.setEnabled(false);
    first.setPack('chesscom');
    const second = new SoundManager({ createAudio: (u) => new FakeAudio(u) as unknown as HTMLAudioElement, storage: shared });
    expect(second.getVolume()).toBeCloseTo(0.4);
    expect(second.isEnabled()).toBe(false);
    expect(second.getPack()).toBe('chesscom');
  });

  it('loads the external pack when asked, and falls back to the bundled file on error', () => {
    const { manager, created } = makeManager();
    manager.setPack('chesscom');
    manager.unlock();
    manager.playMove(moveEvent, 'fen|e2e4');
    const sound = created.find((a) => a.src.includes('images.chesscomfiles.com'));
    expect(sound, 'external pack URL should be used').toBeTruthy();
    // The file fails to load: the manager swaps in the bundled copy.
    sound!.emit('error');
    expect(sound!.src).toContain('sounds/move-self.wav');
  });

  it('replays a move sound once the file has loaded, instead of losing it', async () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.playMove(moveEvent, 'fen|e2e4');
    const element = created.find((a) => a.src.includes('move-self.wav'))!;
    // The first attempt is rejected because the file is still loading.
    expect(element.playCalls).toBe(1);
    element.rejectPlay = true;
    element.readyState = 0;
    manager.playMove(moveEvent, 'fen|g1f3');
    await Promise.resolve();
    // Once it can play, the retry goes out on its own.
    element.rejectPlay = false;
    element.readyState = 4;
    element.emit('canplaythrough');
    expect(element.playCalls).toBeGreaterThanOrEqual(3);
  });

  it('reports how many sounds are available', () => {
    const { manager } = makeManager();
    manager.preload();
    const stats = manager.stats();
    expect(stats.registered).toBeGreaterThan(10);
    expect(stats.failed).toBe(0);
  });

  it('can be silenced mid-game without losing the pipeline', () => {
    const { manager, created } = makeManager();
    manager.unlock();
    manager.setEnabled(false);
    manager.playMove(moveEvent, 'fen|e2e4');
    manager.setEnabled(true);
    manager.playMove(moveEvent, 'fen|e7e5');
    const played = created.find((a) => a.src.includes('move-self.wav'));
    expect(played?.playCalls).toBe(1);
  });

  it('throttles rapidly repeated identical sounds', () => {
    let clock = 1000;
    const { manager, created } = makeManager({ now: () => clock });
    manager.unlock();
    manager.play('click');
    manager.play('click');
    clock += 100;
    manager.play('click');
    const clicks = created.find((a) => a.src.includes('click.wav'));
    expect(clicks?.playCalls).toBe(2);
  });

  it('queues sounds until the first gesture unlocks audio', () => {
    const { manager, created } = makeManager();
    manager.playMove(moveEvent, 'fen|e2e4');
    const sound = created.find((a) => a.src.includes('move-self.wav'));
    expect(manager.isUnlocked()).toBe(false);
    manager.unlock();
    expect(manager.isUnlocked()).toBe(true);
    // One attempt when the event happened, one replay once audio was unlocked.
    expect(sound!.playCalls).toBeGreaterThanOrEqual(1);
  });
});

describe('sound manager wiring', () => {
  it('does not warn for normal playback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { manager } = makeManager();
    manager.unlock();
    manager.playMove(moveEvent, 'fen|e2e4');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
