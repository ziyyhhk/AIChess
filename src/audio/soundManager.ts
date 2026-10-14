/**
 * Sound manager.
 *
 * Design rules (these are what make move sounds reliable):
 *
 * 1. Sounds are triggered from the move pipeline, never from a render, a square
 *    click or an animation callback.
 * 2. One committed move produces one sound plan. A dedupe key identifies the
 *    move, so a re-render, a React StrictMode double effect, a board flip or a
 *    second component noticing the same move cannot replay it.
 * 3. Every event maps to one bundled file. The previous implementation pointed
 *    at `public/sounds/` files that did not exist and only swapped in a remote
 *    CDN URL from an `onerror` handler - so the *first* play of every sound was
 *    always swallowed, which is exactly the "sometimes there is no sound"
 *    symptom. Assets are now bundled, warmed up front, and a failed play is
 *    retried as soon as the media element can play.
 * 4. Autoplay restrictions are handled by queueing events until the first user
 *    gesture unlocks audio, then flushing the queue.
 */
import {
  CHESSCOM_BASE,
  CHESSCOM_FILES,
  SOUND_FILES,
  planMoveSounds,
  type MoveSoundEvent,
  type SoundId,
  type SoundPack,
} from './soundCatalog';

export type { SoundId, SoundPack } from './soundCatalog';
export { planMoveSounds } from './soundCatalog';

const STORAGE_KEY = 'aichess-sound';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  pack: SoundPack;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.7,
  pack: 'builtin',
};

interface ManagedSound {
  url: string;
  element: HTMLAudioElement;
  /** True once the media element reported it has enough data. */
  ready: boolean;
  /** True when the file could not be loaded at all. */
  failed: boolean;
  /** A play() call that was rejected because the element was not ready yet. */
  retryOnCanPlay: boolean;
}

export interface SoundManagerOptions {
  /** Injectable for tests / non-DOM environments. */
  createAudio?: (url: string) => HTMLAudioElement;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
  /** Extra delay after the move sound before a result fanfare. */
  resultDelayMs?: number;
}


export class SoundManager {
  private settings: SoundSettings = { ...DEFAULT_SOUND_SETTINGS };
  private sounds = new Map<SoundId, ManagedSound>();
  private unlocked = false;
  private pendingUnlock: { id: SoundId; volume: number }[] = [];
  private lastPlayedAt = new Map<SoundId, number>();
  /** Recent move identities, so a replay can never double a sound. */
  private recentMoveKeys = new Map<string, number>();
  private followTimers = new Set<ReturnType<typeof setTimeout>>();
  private warned = new Set<string>();
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private now: () => number;
  private createAudio: (url: string) => HTMLAudioElement;
  private resultDelayMs: number;

  constructor(options: SoundManagerOptions = {}) {
    this.createAudio =
      options.createAudio ??
      ((url: string) => {
        const el = new Audio(url);
        el.preload = 'auto';
        return el;
      });
    this.storage =
      options.storage ??
      (typeof localStorage !== 'undefined' ? localStorage : null);
    this.now = options.now ?? (() => Date.now());
    this.resultDelayMs = options.resultDelayMs ?? 320;
    this.loadSettings();
  }

  /* ------------------------------------------------------------- settings */

  private loadSettings() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      if (typeof parsed.enabled === 'boolean') this.settings.enabled = parsed.enabled;
      if (typeof parsed.volume === 'number') {
        this.settings.volume = Math.min(1, Math.max(0, parsed.volume));
      }
      if (parsed.pack === 'builtin' || parsed.pack === 'chesscom') {
        this.settings.pack = parsed.pack;
      }
    } catch {
      /* ignore unreadable storage */
    }
  }

  private persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }

  setEnabled(v: boolean) {
    this.settings.enabled = v;
    if (!v) this.stopPending();
    this.persist();
  }

  isEnabled() {
    return this.settings.enabled;
  }

  setVolume(v: number) {
    this.settings.volume = Math.min(1, Math.max(0, v));
    for (const s of this.sounds.values()) {
      try {
        s.element.volume = this.settings.volume;
      } catch {
        /* ignore */
      }
    }
    this.persist();
  }

  getVolume() {
    return this.settings.volume;
  }

  setPack(pack: SoundPack) {
    if (pack === this.settings.pack) return;
    this.settings.pack = pack;
    this.sounds.clear();
    this.persist();
    this.preload();
  }

  getPack() {
    return this.settings.pack;
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /* ----------------------------------------------------------- lifecycle */

  /** Call from the first user gesture. Flushes anything queued while locked. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const queued = this.pendingUnlock;
    this.pendingUnlock = [];
    for (const item of queued) this.play(item.id);
  }

  isUnlocked() {
    return this.unlocked;
  }

  /** Warm every file in the active pack so the first move is not silent. */
  preload() {
    for (const id of Object.keys(SOUND_FILES) as SoundId[]) {
      this.getSound(id);
    }
  }

  /** Cancel queued follow-up sounds (result fanfares) and stop playback. */
  stopPending() {
    for (const t of this.followTimers) clearTimeout(t);
    this.followTimers.clear();
    for (const s of this.sounds.values()) {
      try {
        s.element.pause();
        s.element.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  /* --------------------------------------------------------------- audio */

  private urlFor(id: SoundId): string {
    const base = (import.meta.env?.BASE_URL as string) || '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    if (this.settings.pack === 'chesscom' && CHESSCOM_FILES[id]) {
      return CHESSCOM_BASE + CHESSCOM_FILES[id];
    }
    return `${normalized}sounds/${SOUND_FILES[id]}`;
  }

  private builtinUrlFor(id: SoundId): string {
    const base = (import.meta.env?.BASE_URL as string) || '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    return `${normalized}sounds/${SOUND_FILES[id]}`;
  }

  private getSound(id: SoundId): ManagedSound | null {
    const existing = this.sounds.get(id);
    if (existing) return existing.failed ? null : existing;

    const url = this.urlFor(id);
    let element: HTMLAudioElement;
    try {
      element = this.createAudio(url);
    } catch {
      return null;
    }
    const managed: ManagedSound = { url, element, ready: false, failed: false, retryOnCanPlay: false };
    this.sounds.set(id, managed);

    try {
      element.volume = this.settings.volume;
    } catch {
      /* ignore */
    }

    const markReady = () => {
      managed.ready = true;
      if (managed.retryOnCanPlay) {
        managed.retryOnCanPlay = false;
        // Bypass the throttles: this is the same event being retried, not a new one.
        if (this.settings.enabled) this.attemptPlayback(id, managed);
      }
    };
    const onError = () => {
      // Optional external pack: fall back to the bundled file for this event.
      const fallback = this.builtinUrlFor(id);
      if (managed.url !== fallback) {
        this.warn(`sound "${id}" unavailable at ${managed.url}; using the bundled file`);
        managed.url = fallback;
        try {
          element.src = fallback;
          element.load?.();
        } catch {
          managed.failed = true;
        }
        return;
      }
      managed.failed = true;
      this.warn(`bundled sound "${id}" failed to load from ${fallback}`);
    };

    element.addEventListener?.('canplaythrough', markReady);
    element.addEventListener?.('loadeddata', markReady);
    element.addEventListener?.('error', onError);
    element.addEventListener?.('ended', () => {
      /* individual elements are replayed from the start each time */
    });

    try {
      element.load?.();
    } catch {
      /* ignore */
    }
    return managed;
  }

  private warn(message: string) {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(`[AIChess sounds] ${message}`);
  }

  /**
   * Play one sound. Returns true when playback was handed to the browser.
   * `dedupeKey` marks the game event that caused this sound.
   */
  play(id: SoundId, dedupeKey?: string): boolean {
    if (!this.settings.enabled) return false;

    if (dedupeKey) {
      const now = this.now();
      this.pruneMoveKeys(now);
      if (this.recentMoveKeys.has(dedupeKey)) return false;
      this.recentMoveKeys.set(dedupeKey, now);
    } else {
      // UI noises (clicks, toggles) are throttled by time. Game moves are not:
      // two different moves must both be heard even if they land milliseconds
      // apart, and their move keys already prevent doubles.
      const now = this.now();
      const previous = this.lastPlayedAt.get(id) ?? -Infinity;
      if (now - previous < 40) return false;
      this.lastPlayedAt.set(id, now);
    }

    const sound = this.getSound(id);
    if (!sound || sound.failed) return false;
    return this.attemptPlayback(id, sound);
  }

  private pruneMoveKeys(now: number) {
    if (this.recentMoveKeys.size < 32) return;
    for (const [key, at] of this.recentMoveKeys) {
      if (now - at > 5000) this.recentMoveKeys.delete(key);
    }
  }

  /** The play itself, with no dedupe or rate limiting. */
  private attemptPlayback(id: SoundId, sound: ManagedSound): boolean {
    const element = sound.element;
    try {
      element.volume = this.settings.volume;
      element.currentTime = 0;
    } catch {
      /* some browsers throw before metadata is known */
    }

    if (!this.unlocked) {
      // Still attempt playback (many browsers allow it after any gesture), but
      // keep a copy so a rejected attempt can be replayed once unlocked.
      this.pendingUnlock.push({ id, volume: this.settings.volume });
    }

    try {
      const result = element.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          if (!sound.ready || element.readyState === 0) {
            // The file is still loading: replay as soon as it can play.
            sound.retryOnCanPlay = true;
          } else if (!this.unlocked) {
            // Autoplay blocked: it will be flushed by unlock().
          } else {
            this.warn(`playback of "${id}" was rejected by the browser`);
          }
        });
      }
      return true;
    } catch {
      this.warn(`playback of "${id}" threw`);
      return false;
    }
  }

  /**
   * Play the sounds for one committed move (and any follow-up result fanfare).
   * The dedupe key makes this idempotent for a given move.
   */
  playMove(event: MoveSoundEvent, dedupeKey: string): boolean {
    const plan = planMoveSounds(event);
    const played = this.play(plan.immediate, dedupeKey);
    if (plan.follow) {
      const delay = Math.max(plan.follow.delayMs, this.resultDelayMs);
      const timer = setTimeout(() => {
        this.followTimers.delete(timer);
        // The result sound shares the move key: it must never fire twice, but it
        // is a different sound id so the per-id rate limit does not block it.
        this.play(plan.follow!.id);
      }, delay);
      this.followTimers.add(timer);
    }
    return played;
  }

  /** Test/debug helper: how many sounds are warmed and available. */
  stats() {
    let loaded = 0;
    let failed = 0;
    for (const s of this.sounds.values()) {
      if (s.failed) failed++;
      else if (s.ready) loaded++;
    }
    return { registered: this.sounds.size, loaded, failed };
  }
}

export const soundManager = new SoundManager();
