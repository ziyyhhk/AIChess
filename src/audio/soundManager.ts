/** Semantic game-event sounds for AIChess. Assets under public/sounds/. */

export type SoundId =
  | 'moveSelf'
  | 'moveOpponent'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'premove'
  | 'illegal'
  | 'gameStart'
  | 'gameEnd'
  | 'gameWin'
  | 'gameLose'
  | 'gameDraw'
  | 'notify'
  | 'click';

const FILE_MAP: Record<SoundId, string> = {
  moveSelf: 'move-self.mp3',
  moveOpponent: 'move-opponent.mp3',
  capture: 'capture.mp3',
  castle: 'castle.mp3',
  check: 'move-check.mp3',
  promote: 'promote.mp3',
  premove: 'premove.mp3',
  illegal: 'illegal.mp3',
  gameStart: 'game-start.mp3',
  gameEnd: 'game-end.mp3',
  gameWin: 'game-win-long.mp3',
  gameLose: 'game-lose-long.mp3',
  gameDraw: 'game-draw.mp3',
  notify: 'notify.mp3',
  click: 'click.mp3',
};

export interface MoveSoundContext {
  isPlayer: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  playerWon?: boolean;
}

class SoundManager {
  private enabled = true;
  private volume = 0.7;
  private unlocked = false;
  private cache = new Map<SoundId, HTMLAudioElement>();
  private lastPlayed: { id: SoundId; at: number } | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem('aichess-sound');
      if (raw) {
        const o = JSON.parse(raw);
        if (typeof o.enabled === 'boolean') this.enabled = o.enabled;
        if (typeof o.volume === 'number') this.volume = Math.min(1, Math.max(0, o.volume));
      }
    } catch {
      /* ignore */
    }
  }

  private persist() {
    try {
      localStorage.setItem(
        'aichess-sound',
        JSON.stringify({ enabled: this.enabled, volume: this.volume })
      );
    } catch {
      /* ignore */
    }
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.persist();
  }

  isEnabled() {
    return this.enabled;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    this.persist();
  }

  getVolume() {
    return this.volume;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
  }

  private url(id: SoundId): string {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}sounds/${FILE_MAP[id]}`;
  }

  private cdnUrl(id: SoundId): string {
    return `https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/${FILE_MAP[id]}`;
  }

  private getAudio(id: SoundId): HTMLAudioElement {
    let a = this.cache.get(id);
    if (!a) {
      a = new Audio(this.url(id));
      a.preload = 'auto';
      a.onerror = () => {
        a!.src = this.cdnUrl(id);
      };
      this.cache.set(id, a);
    }
    return a;
  }

  preload() {
    (Object.keys(FILE_MAP) as SoundId[]).forEach((id) => {
      try {
        this.getAudio(id);
      } catch {
        /* ignore */
      }
    });
  }

  play(id: SoundId) {
    if (!this.enabled) return;
    const now = Date.now();
    if (this.lastPlayed && this.lastPlayed.id === id && now - this.lastPlayed.at < 45) {
      return;
    }
    this.lastPlayed = { id, at: now };
    try {
      const a = this.getAudio(id);
      a.volume = this.volume;
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {
      /* missing file */
    }
  }

  playForMove(ctx: MoveSoundContext) {
    if (ctx.isCheckmate) {
      this.play('check');
      window.setTimeout(() => {
        if (ctx.playerWon === true) this.play('gameWin');
        else if (ctx.playerWon === false) this.play('gameLose');
        else this.play('gameEnd');
      }, 200);
      return;
    }
    if (ctx.isDraw) {
      this.play('gameDraw');
      return;
    }
    if (ctx.isCheck) {
      this.play('check');
      return;
    }
    if (ctx.isCapture) {
      this.play('capture');
      return;
    }
    if (ctx.isCastle) {
      this.play('castle');
      return;
    }
    if (ctx.isPromotion) {
      this.play('promote');
      return;
    }
    this.play(ctx.isPlayer ? 'moveSelf' : 'moveOpponent');
  }
}

export const soundManager = new SoundManager();
