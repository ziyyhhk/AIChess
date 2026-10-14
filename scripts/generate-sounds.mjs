/**
 * Generates the bundled AIChess sound pack.
 *
 * The repository ships its own small, original sound set instead of hot-linking
 * third-party MP3s: external assets can disappear, cost a network request on
 * every move, and cannot be redistributed without written permission.
 *
 * Usage:  node scripts/generate-sounds.mjs
 * Output: public/sounds/<name>.wav  (44.1 kHz, 16-bit, mono PCM)
 *
 * This script is deterministic: running it again produces byte-identical files,
 * so re-generating never creates a noisy diff.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '..', 'public', 'sounds');

const RATE = 44100;

/* ------------------------------------------------------------------ helpers */

/** Deterministic PRNG so noise bursts are reproducible. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

class Buf {
  constructor(seconds) {
    this.data = new Float32Array(Math.ceil(seconds * RATE));
  }
  /** Add a decaying sine partial. */
  tone({ at = 0, freq, dur, gain = 0.5, decay = 6, type = 'sine', pitchDrop = 0 }) {
    const start = Math.floor(at * RATE);
    const len = Math.ceil(dur * RATE);
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= this.data.length) continue;
      const t = i / RATE;
      const p = t / dur;
      const f = freq * (1 - pitchDrop * p);
      const env = Math.exp(-decay * p) * (1 - p * p * 0.15);
      let s;
      if (type === 'square') {
        s = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.6 + Math.sin(2 * Math.PI * f * t) * 0.4;
      } else if (type === 'triangle') {
        const x = (f * t) % 1;
        s = 4 * Math.abs(x - 0.5) - 1;
      } else {
        s = Math.sin(2 * Math.PI * f * t);
      }
      this.data[idx] += s * gain * env;
    }
    return this;
  }
  /** Add a filtered noise burst - the "wooden board" contact transient. */
  noise({ at = 0, dur, gain = 0.4, decay = 14, lowpass = 0.35, seed = 7 }) {
    const start = Math.floor(at * RATE);
    const len = Math.ceil(dur * RATE);
    const rnd = makeRandom(seed);
    let lp = 0;
    let hp = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= this.data.length) continue;
      const p = i / len;
      const white = rnd() * 2 - 1;
      lp += lowpass * (white - lp); // one-pole low pass
      hp = white - lp; // high-frequency remainder
      const env = Math.exp(-decay * p);
      this.data[idx] += (lp * 2.2 + hp * 0.35) * gain * env;
    }
    return this;
  }
  /** Karplus-Strong-ish pluck, used for chimes. */
  pluck({ at = 0, freq, dur, gain = 0.35, decay = 3.2 }) {
    const start = Math.floor(at * RATE);
    const len = Math.ceil(dur * RATE);
    const period = Math.max(2, Math.round(RATE / freq));
    const ring = new Float32Array(period);
    const rnd = makeRandom(Math.round(freq * 1000));
    for (let i = 0; i < period; i++) ring[i] = rnd() * 2 - 1;
    let pos = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      const cur = ring[pos];
      if (idx >= 0 && idx < this.data.length) {
        const p = i / len;
        this.data[idx] += cur * gain * Math.exp(-decay * p);
      }
      const next = ring[(pos + 1) % period];
      ring[pos] = (cur + next) * 0.5 * 0.996;
      pos = (pos + 1) % period;
    }
    return this;
  }
  /** Raise to a target peak and apply a short fade in/out to avoid clicks. */
  finish(peak = 0.85, fadeInMs = 1.2) {
    let max = 0;
    for (const v of this.data) max = Math.max(max, Math.abs(v));
    const norm = max > 0 ? peak / max : 1;
    const fadeIn = Math.max(1, Math.round((fadeInMs / 1000) * RATE));
    const fadeOut = Math.round(0.008 * RATE);
    const n = this.data.length;
    for (let i = 0; i < n; i++) {
      let g = norm;
      if (i < fadeIn) g *= i / fadeIn;
      const tail = n - 1 - i;
      if (tail < fadeOut) g *= tail / fadeOut;
      this.data[i] *= g;
    }
    return this;
  }
  toWav() {
    const n = this.data.length;
    const buffer = Buffer.alloc(44 + n * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + n * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(RATE, 24);
    buffer.writeUInt32LE(RATE * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, this.data[i]));
      buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
    }
    return buffer;
  }
}

/** Wooden piece-on-board contact. */
function thock({ freq = 210, dur = 0.11, gain = 0.9, seed = 11 } = {}) {
  return new Buf(dur)
    .noise({ dur: 0.035, gain: 0.55 * gain, decay: 20, lowpass: 0.28, seed })
    .tone({ freq, dur, gain: 0.45 * gain, decay: 9, pitchDrop: 0.18 })
    .tone({ freq: freq * 2.02, dur: dur * 0.6, gain: 0.16 * gain, decay: 14 });
}

function clack({ dur = 0.16, gain = 1 } = {}) {
  return new Buf(dur)
    .noise({ dur: 0.028, gain: 0.7 * gain, decay: 26, lowpass: 0.55, seed: 23 })
    .tone({ freq: 168, dur, gain: 0.5 * gain, decay: 8, pitchDrop: 0.25 })
    .noise({ at: 0.035, dur: 0.03, gain: 0.32 * gain, decay: 24, lowpass: 0.7, seed: 41 });
}

function ping({ freq = 1046, dur = 0.3, gain = 0.5, at = 0 } = {}) {
  return new Buf(dur + at)
    .pluck({ at, freq, dur, gain, decay: 5 })
    .tone({ at, freq, dur, gain: gain * 0.25, decay: 7 });
}

/* ------------------------------------------------------------------- sounds */

const sounds = {
  // A plain move by the player: soft, mid-pitch wooden knock.
  'move-self': () => thock({ freq: 236, dur: 0.11, gain: 0.95, seed: 11 }),

  // A plain move by the opponent: same family, slightly darker so it is audible
  // which side just moved.
  'move-opponent': () => thock({ freq: 186, dur: 0.12, gain: 0.95, seed: 29 }),

  capture: () => clack({ dur: 0.17 }),

  // Two contacts in quick succession - king, then rook.
  castle: () => {
    const a = new Buf(0.34);
    const first = thock({ freq: 214, dur: 0.11, seed: 13 });
    const second = thock({ freq: 196, dur: 0.12, seed: 17 });
    a.data.set(first.data, 0);
    a.data.set(second.data, Math.round(0.085 * RATE));
    return a;
  },

  // Quiet UI tick while a premove is queued.
  premove: () => {
    const b = new Buf(0.09);
    b.tone({ freq: 1318, dur: 0.05, gain: 0.28, decay: 16 });
    b.tone({ freq: 1976, dur: 0.04, gain: 0.12, decay: 18 });
    return b;
  },

  // Move + check: contact first, then a bright alert tone.
  'move-check': () =>
    merge([
      [thock({ freq: 232, dur: 0.11, seed: 11 }), 0],
      [ping({ freq: 1046, dur: 0.26, gain: 0.5 }), 0.05],
    ]),

  // Player delivers check: a touch brighter.
  'move-self-check': () =>
    merge([
      [thock({ freq: 236, dur: 0.11, seed: 11 }), 0],
      [ping({ freq: 1175, dur: 0.26, gain: 0.48 }), 0.05],
    ]),

  // Opponent delivers check: a touch darker.
  'move-opponent-check': () =>
    merge([
      [thock({ freq: 186, dur: 0.12, seed: 29 }), 0],
      [ping({ freq: 880, dur: 0.28, gain: 0.5 }), 0.05],
    ]),

  // Promotion: rising three-note chime.
  promote: () =>
    merge([
      [ping({ freq: 523.25, dur: 0.30, gain: 0.42 }), 0],
      [ping({ freq: 659.25, dur: 0.32, gain: 0.4 }), 0.09],
      [ping({ freq: 783.99, dur: 0.42, gain: 0.44 }), 0.18],
    ]),

  'game-start': () =>
    merge([
      [thock({ freq: 208, dur: 0.11, seed: 5 }), 0],
      [ping({ freq: 587.33, dur: 0.34, gain: 0.4 }), 0.1],
      [ping({ freq: 880.0, dur: 0.4, gain: 0.36 }), 0.2],
    ]),

  'game-end': () => merge([[ping({ freq: 659.25, dur: 0.4, gain: 0.36 }), 0]]),

  'game-win-long': () =>
    merge([
      [ping({ freq: 523.25, dur: 0.5, gain: 0.38 }), 0],
      [ping({ freq: 659.25, dur: 0.5, gain: 0.36 }), 0.13],
      [ping({ freq: 783.99, dur: 0.6, gain: 0.36 }), 0.26],
      [ping({ freq: 1046.5, dur: 0.9, gain: 0.42 }), 0.39],
    ]),

  'game-lose-long': () =>
    merge([
      [ping({ freq: 587.33, dur: 0.5, gain: 0.36 }), 0],
      [ping({ freq: 493.88, dur: 0.5, gain: 0.34 }), 0.14],
      [ping({ freq: 392.0, dur: 0.6, gain: 0.34 }), 0.28],
      [ping({ freq: 293.66, dur: 1.0, gain: 0.4 }), 0.42],
    ]),

  'game-draw': () =>
    merge([
      [ping({ freq: 523.25, dur: 0.4, gain: 0.34 }), 0],
      [ping({ freq: 523.25, dur: 0.7, gain: 0.34 }), 0.2],
    ]),

  notify: () => ping({ freq: 987.77, dur: 0.4, gain: 0.42 }),

  illegal: () => {
    const b = new Buf(0.19);
    b.tone({ freq: 146.83, dur: 0.17, gain: 0.42, decay: 5.5, type: 'square' });
    b.tone({ freq: 110.0, dur: 0.18, gain: 0.3, decay: 5 });
    return b;
  },

  click: () => {
    const b = new Buf(0.03);
    b.noise({ dur: 0.02, gain: 0.32, decay: 40, lowpass: 0.8, seed: 3 });
    return b;
  },

  // Around ten seconds left on a clock.
  tenseconds: () =>
    merge([
      [ping({ freq: 1046.5, dur: 0.16, gain: 0.4 }), 0],
      [ping({ freq: 1318.5, dur: 0.2, gain: 0.36 }), 0.18],
    ]),
};

/** Overlay buffers at fixed offsets, then normalise the result. */
function merge(parts) {
  const total = parts.reduce((max, [buf, at]) => Math.max(max, at + buf.data.length / RATE), 0);
  const out = new Buf(total + 0.01);
  for (const [buf, at] of parts) {
    const offset = Math.round(at * RATE);
    for (let i = 0; i < buf.data.length; i++) out.data[offset + i] += buf.data[i];
  }
  return out;
}

/* --------------------------------------------------------------------- main */

mkdirSync(OUT_DIR, { recursive: true });
const names = Object.keys(sounds);
for (const name of names) {
  const buf = sounds[name]().finish(name === 'illegal' ? 0.6 : 0.85);
  const file = resolve(OUT_DIR, `${name}.wav`);
  writeFileSync(file, buf.toWav());
  console.log(`wrote ${name}.wav  (${(buf.data.length / 2).toFixed(2)} KB, ${(buf.data.length / RATE * 1000).toFixed(0)} ms)`);
}
console.log(`\n${names.length} sounds written to public/sounds/`);
